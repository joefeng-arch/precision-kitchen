import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, ILike, In, Repository } from 'typeorm';
import { FREE_RECIPE_LIMIT } from '../../common/constants/tier-limits';
import { paginate } from '../../common/dto/pagination.dto';
import type { ScalingProfile } from '../../common/utils/scaling-engine';
import type { UserRole } from '../users/entities/user.entity';
import { collectScalingErrors } from './parse-scaling-validator';
import { Category } from '../categories/entities/category.entity';
import { Ingredient } from '../ingredients/entities/ingredient.entity';
import { User } from '../users/entities/user.entity';
import {
  CreateRecipeDto,
  ListRecipesDto,
  RecipeIngredientDto,
  RecipeStepDto,
  UpdateRecipeDto,
} from './dto/recipe.dto';
import { RecipeCategory } from './entities/recipe-category.entity';
import { RecipeIngredient } from './entities/recipe-ingredient.entity';
import { RecipeStep } from './entities/recipe-step.entity';
import { RecipeVersion } from './entities/recipe-version.entity';
import { Recipe } from './entities/recipe.entity';

export interface RecipeWithExtras extends Recipe {
  author?: { id: string; nickname: string; avatar: string | null } | null;
  categories?: Array<{ id: number; name: string }>;
  categoryIds?: number[];
}

@Injectable()
export class RecipesService {
  constructor(
    @InjectRepository(Recipe) private readonly recipes: Repository<Recipe>,
    @InjectRepository(RecipeIngredient)
    private readonly ris: Repository<RecipeIngredient>,
    @InjectRepository(RecipeStep) private readonly steps: Repository<RecipeStep>,
    @InjectRepository(RecipeVersion)
    private readonly versions: Repository<RecipeVersion>,
    @InjectRepository(RecipeCategory)
    private readonly recipeCategories: Repository<RecipeCategory>,
    @InjectRepository(Ingredient)
    private readonly ingredients: Repository<Ingredient>,
    @InjectRepository(Category)
    private readonly categories: Repository<Category>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly ds: DataSource,
  ) {}

  async list(query: ListRecipesDto) {
    const {
      page = 1,
      pageSize = 20,
      keyword,
      categoryId,
      mealSceneId,
      status,
      authorId,
      isPublic,
      isFeatured,
    } = query;
    const where: Record<string, unknown> = {};
    if (mealSceneId) where.mealSceneId = mealSceneId;
    if (status) where.status = status;
    if (authorId) where.authorId = authorId;
    if (isPublic !== undefined) where.isPublic = isPublic;
    if (isFeatured !== undefined) where.isFeatured = isFeatured;
    if (keyword) where.title = ILike(`%${keyword}%`);

    // categoryId 走多对多：先查 recipe_categories
    let recipeIdFilter: string[] | null = null;
    if (categoryId) {
      const rcs = await this.recipeCategories.find({ where: { categoryId } });
      recipeIdFilter = rcs.map((rc) => rc.recipeId);
      if (recipeIdFilter.length === 0) {
        return paginate([], 0, page, pageSize);
      }
      where.id = In(recipeIdFilter);
    }

    // 公开列表：官方推荐排最前
    const order: Record<string, 'ASC' | 'DESC'> = isPublic
      ? { isFeatured: 'DESC', updatedAt: 'DESC' }
      : { updatedAt: 'DESC' };

    const [items, total] = await this.recipes.findAndCount({
      where,
      order,
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    const enriched = await Promise.all(
      items.map((r) => this.enrichRecipe(r, { withIngredientNames: false })),
    );
    return paginate(enriched, total, page, pageSize);
  }

  async findOne(id: string): Promise<RecipeWithExtras> {
    const recipe = await this.recipes.findOne({
      where: { id },
      relations: ['ingredients', 'steps'],
    });
    if (!recipe) throw new NotFoundException('Recipe not found');
    recipe.ingredients.sort((a, b) => a.sort - b.sort || a.id - b.id);
    recipe.steps.sort((a, b) => a.stepNumber - b.stepNumber);
    return this.enrichRecipe(recipe, { withIngredientNames: true });
  }

  async create(
    authorId: string,
    dto: CreateRecipeDto,
    tier: UserRole = 'user', // 缺省朝上限 fail-closed；仅用户 controller 调本方法
  ): Promise<RecipeWithExtras> {
    // FREE 配方数上限（PRD §5.2）；vip 无限
    if (tier !== 'vip') {
      const count = await this.recipes.count({ where: { authorId } });
      if (count >= FREE_RECIPE_LIMIT) {
        throw new ForbiddenException(
          `Recipe limit reached (${FREE_RECIPE_LIMIT} on the free plan) — upgrade to PRO for unlimited recipes`,
        );
      }
    }

    const profile: ScalingProfile = dto.scalingProfile ?? 'linear_legacy';
    this.assertScalingConsistent(profile, dto.ingredients, dto.baseAnchor);

    return this.ds.transaction(async (mgr) => {
      const recipe = mgr.create(Recipe, {
        authorId,
        title: dto.title,
        description: dto.description ?? null,
        coverImage: dto.coverImage ?? null,
        categoryId: dto.categoryId ?? null,
        mealSceneId: dto.mealSceneId ?? null,
        baseServings: dto.baseServings ?? 2,
        difficulty: dto.difficulty ?? 'medium',
        totalMinutes: dto.totalMinutes ?? null,
        status: dto.status ?? 'draft',
        isPublic: dto.isPublic ?? false,
        tags: dto.tags ?? [],
        scalingProfile: profile,
        versionCount: 1,
      });
      const saved = await mgr.save(recipe);
      const savedIngs = await this.replaceChildren(
        mgr,
        saved.id,
        dto.ingredients,
        dto.steps,
        profile,
      );
      await this.remapBaseAnchor(mgr, saved.id, dto.baseAnchor, savedIngs);
      await this.replaceCategories(
        mgr,
        saved.id,
        dto.categoryIds ?? (dto.categoryId ? [dto.categoryId] : []),
      );
      await this.snapshot(mgr, saved.id, authorId, 1, 'initial');
      const fresh = await this.findOneInTx(mgr, saved.id);
      return this.enrichRecipe(fresh, { withIngredientNames: true });
    });
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateRecipeDto,
    isAdmin = false,
  ): Promise<RecipeWithExtras> {
    return this.ds.transaction(async (mgr) => {
      // 只查主表，避免把 children 关联实体带进 cascade 路径
      const recipe = await mgr.findOne(Recipe, { where: { id } });
      if (!recipe) throw new NotFoundException('Recipe not found');
      if (!isAdmin && recipe.authorId !== userId) {
        throw new ForbiddenException('Not your recipe');
      }

      // 缩放配置与 ingredients 强绑定：children 重插会换 ingredient id，
      // 任何 id 形 percentBase 若不随 ingredients 一并提交必然悬垂。
      // （单独把 scalingProfile 降级为 linear_legacy 是允许的。）
      if (
        dto.ingredients === undefined &&
        (dto.baseAnchor !== undefined ||
          (dto.scalingProfile !== undefined && dto.scalingProfile !== 'linear_legacy'))
      ) {
        throw new BadRequestException('Scaling configuration must be submitted together with ingredients');
      }

      // 只 patch 显式给出的列；用 mgr.update 不触发 @OneToMany cascade
      const patchable = [
        'title',
        'description',
        'coverImage',
        'categoryId',
        'mealSceneId',
        'baseServings',
        'difficulty',
        'totalMinutes',
        'status',
        'isPublic',
        'tags',
        'scalingProfile',
      ] as const;
      const dtoRec = dto as unknown as Record<string, unknown>;
      const updateFields: Record<string, unknown> = {};
      for (const key of patchable) {
        if (dtoRec[key] !== undefined) updateFields[key] = dtoRec[key];
      }

      if (dto.ingredients !== undefined || dto.steps !== undefined) {
        // 任一给出就走 replace；未给出的一侧从 DB 现状映射回 DTO 形态
        const effectiveProfile: ScalingProfile =
          dto.scalingProfile ?? recipe.scalingProfile ?? 'linear_legacy';
        if (dto.ingredients !== undefined) {
          this.assertScalingConsistent(effectiveProfile, dto.ingredients, dto.baseAnchor);
        }

        const existingIngs =
          dto.ingredients === undefined
            ? await mgr.find(RecipeIngredient, { where: { recipeId: id } })
            : null;
        const existingSteps =
          dto.steps === undefined ? await mgr.find(RecipeStep, { where: { recipeId: id } }) : null;
        const savedIngs = await this.replaceChildren(
          mgr,
          recipe.id,
          dto.ingredients ?? existingIngs!.map(this.riToDto),
          dto.steps ?? existingSteps!.map(this.stepToDto),
          effectiveProfile,
        );

        if (dto.ingredients !== undefined) {
          // 新 ingredients：baseAnchor 一并重发则重映射；否则旧引用不再可信 → 置 null
          await this.remapBaseAnchor(mgr, recipe.id, dto.baseAnchor, savedIngs, {
            clearWhenAbsent: true,
          });
        } else if (existingIngs) {
          // steps-only 往返重插：已存 id 形 percentBase 按位置映射到新 id（group 形保留）
          const pb = recipe.baseAnchor?.percentBase;
          if (pb && 'id' in pb) {
            const pos = existingIngs.findIndex((r) => r.id === pb.id);
            await mgr.update(
              Recipe,
              { id: recipe.id },
              {
                baseAnchor: pos >= 0 ? { percentBase: { id: savedIngs[pos].id } } : null,
              },
            );
          }
        }
      }

      if (dto.categoryIds !== undefined) {
        await this.replaceCategories(mgr, recipe.id, dto.categoryIds);
      }

      const nextVersion = recipe.versionCount + 1;
      updateFields.versionCount = nextVersion;
      if (Object.keys(updateFields).length > 0) {
        await mgr.update(Recipe, { id: recipe.id }, updateFields);
      }
      await this.snapshot(mgr, recipe.id, userId, nextVersion, dto.changeNote ?? null);
      const fresh = await this.findOneInTx(mgr, recipe.id);
      return this.enrichRecipe(fresh, { withIngredientNames: true });
    });
  }

  async remove(userId: string, id: string, isAdmin = false) {
    const recipe = await this.recipes.findOne({ where: { id } });
    if (!recipe) throw new NotFoundException('Recipe not found');
    if (!isAdmin && recipe.authorId !== userId) {
      throw new ForbiddenException('Not your recipe');
    }
    // 先清关联表
    await this.recipeCategories.delete({ recipeId: id });
    await this.recipes.remove(recipe);
    return { id };
  }

  /** 批量删除：只能删自己作者的；admin 可全删 */
  async batchRemove(userId: string, ids: string[], isAdmin = false) {
    if (!ids.length) return { deleted: 0 };
    const where: Record<string, unknown> = { id: In(ids) };
    if (!isAdmin) where.authorId = userId;
    const targets = await this.recipes.find({ where });
    if (!targets.length) return { deleted: 0 };
    await this.recipeCategories.delete({ recipeId: In(targets.map((t) => t.id)) });
    await this.recipes.remove(targets);
    return { deleted: targets.length, ids: targets.map((t) => t.id) };
  }

  listVersions(recipeId: string) {
    return this.versions.find({
      where: { recipeId },
      order: { versionNumber: 'DESC' },
    });
  }

  // -------- enrich --------

  private async enrichRecipe(
    recipe: Recipe,
    opts: { withIngredientNames: boolean },
  ): Promise<RecipeWithExtras> {
    const out = recipe as RecipeWithExtras;

    // author
    const author = await this.users.findOne({ where: { id: recipe.authorId } });
    out.author = author
      ? { id: author.id, nickname: author.nickname, avatar: author.avatar }
      : null;

    // categories (多对多)
    const rcs = await this.recipeCategories.find({ where: { recipeId: recipe.id } });
    if (rcs.length) {
      const cats = await this.categories.find({
        where: { id: In(rcs.map((rc) => rc.categoryId)) },
      });
      out.categories = cats.map((c) => ({ id: c.id, name: c.name }));
      out.categoryIds = cats.map((c) => c.id);
    } else {
      out.categories = [];
      out.categoryIds = [];
    }

    // ingredient names (列表里跳过，详情时才查；避免 N+1)
    if (opts.withIngredientNames && recipe.ingredients?.length) {
      const ingredientIds = recipe.ingredients
        .map((ri) => ri.ingredientId)
        .filter((id): id is number => id != null);
      if (ingredientIds.length) {
        const pubs = await this.ingredients.find({ where: { id: In(ingredientIds) } });
        const nameMap = new Map(pubs.map((p) => [p.id, p.name]));
        recipe.ingredients = recipe.ingredients.map((ri) => {
          const display =
            ri.customName ?? (ri.ingredientId ? (nameMap.get(ri.ingredientId) ?? null) : null);
          // 把 name 塞到响应里（虽然实体没这个字段，但 JSON.stringify 会带上）
          (ri as RecipeIngredient & { name?: string | null }).name = display;
          return ri;
        });
      } else {
        recipe.ingredients = recipe.ingredients.map((ri) => {
          (ri as RecipeIngredient & { name?: string | null }).name = ri.customName;
          return ri;
        });
      }
    }

    return out;
  }

  // -------- helpers --------

  private riToDto = (ri: RecipeIngredient): RecipeIngredientDto => ({
    ingredientId: ri.ingredientId ?? undefined,
    customName: ri.customName ?? undefined,
    amount: parseFloat(ri.amount),
    unit: ri.unit,
    scaleType: ri.scaleType,
    scaleFactor: parseFloat(ri.scaleFactor),
    groupName: ri.groupName ?? undefined,
    notes: ri.notes ?? undefined,
    sort: ri.sort,
    // 缩放字段必须参与往返，否则 steps-only 更新会把它们静默清空
    scalingRole: ri.scalingRole ?? undefined,
    percentageValue: ri.percentageValue != null ? parseFloat(ri.percentageValue) : undefined,
    ratioGroup: ri.ratioGroup ?? undefined,
    ratioValue: ri.ratioValue != null ? parseFloat(ri.ratioValue) : undefined,
    roundDp: ri.roundDp ?? undefined,
  });

  private stepToDto = (s: RecipeStep): RecipeStepDto => ({
    stepNumber: s.stepNumber,
    description: s.description,
    imageUrl: s.imageUrl ?? undefined,
    durationSeconds: s.durationSeconds ?? undefined,
    tips: s.tips ?? undefined,
    // warning 必须参与往返，否则 ingredients-only 更新会把它静默清空（同 riToDto 的缩放字段）
    warning: s.warning ?? undefined,
  });

  /** 返回保存后的 ingredients（含分配的 id，供 baseAnchor 下标→id 重映射） */
  private async replaceChildren(
    mgr: import('typeorm').EntityManager,
    recipeId: string,
    ingredients: RecipeIngredientDto[],
    steps: RecipeStepDto[],
    profile: ScalingProfile,
  ): Promise<RecipeIngredient[]> {
    await mgr.delete(RecipeIngredient, { recipeId });
    await mgr.delete(RecipeStep, { recipeId });

    // linear_legacy 不使用缩放字段：强制剥离，避免惰性脏数据误导前端工作台
    const scaling = profile === 'linear_legacy' ? null : profile;

    let savedIngs: RecipeIngredient[] = [];
    if (ingredients.length) {
      const entities = ingredients.map((i, idx) =>
        mgr.create(RecipeIngredient, {
          recipeId,
          ingredientId: i.ingredientId ?? null,
          customName: i.customName ?? null,
          amount: i.amount.toFixed(2),
          unit: i.unit,
          scaleType: i.scaleType ?? 'linear',
          scaleFactor: (i.scaleFactor ?? 0.7).toFixed(2),
          groupName: i.groupName ?? null,
          notes: i.notes ?? null,
          sort: i.sort ?? idx,
          scalingRole: scaling ? (i.scalingRole ?? null) : null,
          percentageValue:
            scaling && i.percentageValue != null ? i.percentageValue.toFixed(3) : null,
          ratioGroup: scaling ? (i.ratioGroup ?? null) : null,
          ratioValue: scaling && i.ratioValue != null ? i.ratioValue.toFixed(3) : null,
          roundDp: scaling ? (i.roundDp ?? null) : null,
        }),
      );
      savedIngs = await mgr.save(entities);
    }

    if (steps.length) {
      const entities = steps.map((s) =>
        mgr.create(RecipeStep, {
          recipeId,
          stepNumber: s.stepNumber,
          description: s.description,
          imageUrl: s.imageUrl ?? null,
          durationSeconds: s.durationSeconds ?? null,
          tips: s.tips ?? null,
          warning: s.warning ?? null,
        }),
      );
      await mgr.save(entities);
    }
    return savedIngs;
  }

  /** 保存时缩放结构强校验：不一致直接 400（显式保存脏数据是客户端错误，不静默降级） */
  private assertScalingConsistent(
    profile: ScalingProfile,
    ingredients: RecipeIngredientDto[],
    baseAnchor?: { percentBase?: { ingredientIndex?: number; group?: string } },
  ) {
    const errors = collectScalingErrors(
      profile,
      ingredients.map((i) => ({
        scalingRole: i.scalingRole ?? null,
        percentageValue: i.percentageValue ?? null,
        ratioGroup: i.ratioGroup ?? null,
        ratioValue: i.ratioValue ?? null,
        amount: i.amount,
      })),
      baseAnchor?.percentBase ?? null,
    );
    if (errors.length > 0) {
      throw new BadRequestException(`Inconsistent scaling configuration: ${errors.join('; ')}`);
    }
  }

  /**
   * baseAnchor 下标→id 重映射（照种子模式：ingredients 插入后回写）。
   * clearWhenAbsent：ingredients 被整体替换而 baseAnchor 未重发时，旧引用（id 已换）不再可信 → 置 null。
   */
  private async remapBaseAnchor(
    mgr: import('typeorm').EntityManager,
    recipeId: string,
    baseAnchor: { percentBase?: { ingredientIndex?: number; group?: string } } | undefined,
    savedIngs: RecipeIngredient[],
    opts?: { clearWhenAbsent?: boolean },
  ) {
    const pb = baseAnchor?.percentBase;
    if (!pb) {
      if (opts?.clearWhenAbsent) {
        await mgr.update(Recipe, { id: recipeId }, { baseAnchor: null });
      }
      return;
    }
    const value =
      pb.ingredientIndex != null
        ? { percentBase: { id: savedIngs[pb.ingredientIndex].id } }
        : { percentBase: { group: pb.group as string } };
    await mgr.update(Recipe, { id: recipeId }, { baseAnchor: value });
  }

  private async replaceCategories(
    mgr: import('typeorm').EntityManager,
    recipeId: string,
    categoryIds: number[],
  ) {
    await mgr.delete(RecipeCategory, { recipeId });
    const unique = Array.from(new Set(categoryIds.filter((id) => Number.isFinite(id))));
    if (!unique.length) return;
    const entities = unique.map((cid) => mgr.create(RecipeCategory, { recipeId, categoryId: cid }));
    await mgr.save(entities);
  }

  private async snapshot(
    mgr: import('typeorm').EntityManager,
    recipeId: string,
    editorId: string,
    versionNumber: number,
    changeNote: string | null,
  ) {
    const full = await this.findOneInTx(mgr, recipeId);
    const version = mgr.create(RecipeVersion, {
      recipeId,
      editorId,
      versionNumber,
      changeNote,
      snapshot: JSON.parse(JSON.stringify(full)) as Record<string, unknown>,
    });
    await mgr.save(version);
  }

  private async findOneInTx(mgr: import('typeorm').EntityManager, id: string): Promise<Recipe> {
    const recipe = await mgr.findOne(Recipe, {
      where: { id },
      relations: ['ingredients', 'steps'],
    });
    if (!recipe) throw new NotFoundException('Recipe not found');
    recipe.ingredients.sort((a, b) => a.sort - b.sort || a.id - b.id);
    recipe.steps.sort((a, b) => a.stepNumber - b.stepNumber);
    return recipe;
  }
}

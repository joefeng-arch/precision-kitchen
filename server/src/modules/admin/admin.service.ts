import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import { paginate } from '../../common/dto/pagination.dto';
import { Category } from '../categories/entities/category.entity';
import { CookingLog } from '../cooking/entities/cooking-log.entity';
import { Favorite } from '../favorites/entities/favorite.entity';
import { Ingredient } from '../ingredients/entities/ingredient.entity';
import { RecipeCategory } from '../recipes/entities/recipe-category.entity';
import { RecipeIngredient } from '../recipes/entities/recipe-ingredient.entity';
import { RecipeStep } from '../recipes/entities/recipe-step.entity';
import { Recipe, RecipeStatus } from '../recipes/entities/recipe.entity';
import { User, UserRole, UserStatus } from '../users/entities/user.entity';
import {
  AdminCreateCategoryDto,
  AdminCreateIngredientDto,
  AdminCreateOfficialRecipeDto,
  AdminListCategoriesDto,
  AdminListIngredientsDto,
  AdminListRecipesDto,
  AdminListUsersDto,
  AdminUpdateCategoryDto,
  AdminUpdateIngredientDto,
  AdminUpdateRecipeDto,
  ReorderCategoriesDto,
} from './dto/admin.dto';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Recipe) private readonly recipes: Repository<Recipe>,
    @InjectRepository(RecipeIngredient)
    private readonly recipeIngredients: Repository<RecipeIngredient>,
    @InjectRepository(RecipeStep) private readonly recipeSteps: Repository<RecipeStep>,
    @InjectRepository(RecipeCategory) private readonly recipeCategories: Repository<RecipeCategory>,
    @InjectRepository(CookingLog) private readonly logs: Repository<CookingLog>,
    @InjectRepository(Favorite) private readonly favorites: Repository<Favorite>,
    @InjectRepository(Ingredient) private readonly ingredients: Repository<Ingredient>,
    @InjectRepository(Category) private readonly categories: Repository<Category>,
    private readonly dataSource: DataSource,
  ) {}

  /* ═══════════════════════ Stats ═══════════════════════ */

  async stats() {
    const since = new Date();
    since.setHours(0, 0, 0, 0);

    const [
      userTotal,
      recipeTotal,
      recipePublished,
      recipeDraft,
      cookingLogTotal,
      newUsersToday,
      newRecipesToday,
      newCookingLogsToday,
      ingredientTotal,
      categoryTotal,
    ] = await Promise.all([
      this.users.count(),
      this.recipes.count(),
      this.recipes.count({ where: { status: 'published' } }),
      this.recipes.count({ where: { status: 'draft' } }),
      this.logs.count(),
      this.users.createQueryBuilder('u').where('u.createdAt >= :since', { since }).getCount(),
      this.recipes.createQueryBuilder('r').where('r.createdAt >= :since', { since }).getCount(),
      this.logs.createQueryBuilder('l').where('l.createdAt >= :since', { since }).getCount(),
      this.ingredients.count(),
      this.categories.count({ where: { ownerId: IsNull() } }),
    ]);

    return {
      users: { total: userTotal, newToday: newUsersToday },
      recipes: {
        total: recipeTotal,
        published: recipePublished,
        draft: recipeDraft,
        newToday: newRecipesToday,
      },
      cooking: { totalLogs: cookingLogTotal, newToday: newCookingLogsToday },
      ingredients: { total: ingredientTotal },
      categories: { total: categoryTotal },
    };
  }

  /* ═══════════════════════ Recipes ═══════════════════════ */

  async listRecipes(query: AdminListRecipesDto) {
    const {
      page = 1,
      pageSize = 20,
      keyword,
      status,
      authorId,
      categoryId,
      isFeatured,
      dateFrom,
      dateTo,
    } = query;

    const qb = this.recipes
      .createQueryBuilder('r')
      .leftJoin(User, 'author', 'author.id = r.authorId')
      .addSelect(['author.id', 'author.nickname'])
      .leftJoin(Category, 'cat', 'cat.id = r.categoryId')
      .addSelect(['cat.name'])
      .addSelect(
        (sq) => sq.select('COUNT(*)').from(Favorite, 'fav').where('fav.recipeId = r.id'),
        'favoriteCount',
      );

    if (status) qb.andWhere('r.status = :status', { status });
    if (authorId) qb.andWhere('r.authorId = :authorId', { authorId });
    if (keyword) qb.andWhere('r.title ILIKE :keyword', { keyword: `%${keyword}%` });
    if (isFeatured !== undefined) {
      const featured = isFeatured === 'true';
      qb.andWhere('r.isFeatured = :featured', { featured });
    }
    if (categoryId) {
      qb.andWhere(
        `r.id IN (SELECT rc."recipeId" FROM recipe_categories rc WHERE rc."categoryId" = :categoryId)`,
        { categoryId },
      );
    }
    if (dateFrom) qb.andWhere('r.createdAt >= :dateFrom', { dateFrom: new Date(dateFrom) });
    if (dateTo) qb.andWhere('r.createdAt <= :dateTo', { dateTo: new Date(dateTo) });

    qb.orderBy('r.createdAt', 'DESC');

    const total = await qb.getCount();
    qb.offset((page - 1) * pageSize).limit(pageSize);

    const rawResults = await qb.getRawAndEntities();

    // Map raw join data onto entities
    const items = rawResults.entities.map((entity: Recipe, i: number) => ({
      ...entity,
      author: {
        id: rawResults.raw[i]?.author_id ?? null,
        nickname: rawResults.raw[i]?.author_nickname ?? null,
      },
      categoryName: rawResults.raw[i]?.cat_name ?? null,
      favoriteCount: parseInt(rawResults.raw[i]?.favoriteCount ?? '0', 10),
    }));

    return paginate(items, total, page, pageSize);
  }

  async getRecipeDetail(id: string) {
    const recipe = await this.recipes.findOne({
      where: { id },
      relations: ['ingredients', 'steps'],
    });
    if (!recipe) throw new NotFoundException('Recipe not found');

    // Resolve author info
    const author = await this.users.findOne({
      where: { id: recipe.authorId },
      select: ['id', 'nickname', 'avatar'],
    });

    // Resolve ingredient names from Ingredient table
    const ingredientIds = recipe.ingredients
      .map((ri) => ri.ingredientId)
      .filter((iid): iid is number => iid !== null);

    let ingredientMap: Record<number, string> = {};
    if (ingredientIds.length > 0) {
      const ingredientEntities = await this.ingredients.find({
        where: { id: In(ingredientIds) },
        select: ['id', 'name'],
      });
      ingredientMap = Object.fromEntries(ingredientEntities.map((ing) => [ing.id, ing.name]));
    }

    const ingredientsWithNames = recipe.ingredients
      .sort((a, b) => a.sort - b.sort)
      .map((ri) => ({
        ...ri,
        ingredientName: ri.ingredientId ? (ingredientMap[ri.ingredientId] ?? null) : null,
      }));

    // Get categories via junction table
    const recipeCats = await this.recipeCategories.find({ where: { recipeId: id } });
    let categoryDetails: { id: number; name: string; type: string }[] = [];
    if (recipeCats.length > 0) {
      const catIds = recipeCats.map((rc) => rc.categoryId);
      const cats = await this.categories.find({ where: { id: In(catIds) } });
      categoryDetails = cats.map((c) => ({ id: c.id, name: c.name, type: c.type }));
    }

    return {
      ...recipe,
      ingredients: ingredientsWithNames,
      steps: recipe.steps.sort((a, b) => a.stepNumber - b.stepNumber),
      author: author ?? null,
      categories: categoryDetails,
    };
  }

  async createOfficialRecipe(dto: AdminCreateOfficialRecipeDto) {
    // Find the 老舅官方 virtual user
    const officialUser = await this.users
      .createQueryBuilder('u')
      .where('u.openid IS NULL')
      .andWhere('u.nickname = :name', { name: '老舅官方' })
      .getOne();

    if (!officialUser) {
      throw new BadRequestException(
        '系统用户"老舅官方"不存在，请先在 users 表中创建一个 openid=NULL, nickname="老舅官方" 的用户',
      );
    }

    // 在事务内创建菜谱及关联数据，只返回 savedRecipe.id
    const newRecipeId = await this.dataSource.transaction(async (manager) => {
      // Create the recipe
      const recipe = manager.create(Recipe, {
        authorId: officialUser.id,
        title: dto.title,
        description: dto.description ?? null,
        coverImage: dto.coverImage ?? null,
        categoryId: dto.categoryId ?? null,
        mealSceneId: dto.mealSceneId ?? null,
        baseServings: dto.baseServings,
        difficulty: dto.difficulty,
        totalMinutes: dto.totalMinutes ?? null,
        tags: dto.tags ?? [],
        status: 'published' as RecipeStatus,
        isPublic: true,
        isFeatured: true,
      });
      const savedRecipe = await manager.save(Recipe, recipe);

      // Save ingredients
      if (dto.ingredients?.length) {
        const ingredientEntities = dto.ingredients.map((item, idx) =>
          manager.create(RecipeIngredient, {
            recipeId: savedRecipe.id,
            ingredientId: item.ingredientId ?? null,
            customName: item.customName ?? null,
            amount: item.amount,
            unit: item.unit,
            scaleType: item.scaleType ?? 'linear',
            scaleFactor: item.scaleFactor ?? '0.70',
            groupName: item.groupName ?? null,
            notes: item.notes ?? null,
            sort: item.sort ?? idx,
          }),
        );
        await manager.save(RecipeIngredient, ingredientEntities);
      }

      // Save steps
      if (dto.steps?.length) {
        const stepEntities = dto.steps.map((item) =>
          manager.create(RecipeStep, {
            recipeId: savedRecipe.id,
            stepNumber: item.stepNumber,
            description: item.description,
            imageUrl: item.imageUrl ?? null,
            durationSeconds: item.durationSeconds ?? null,
            tips: item.tips ?? null,
          }),
        );
        await manager.save(RecipeStep, stepEntities);
      }

      // Save category junction entries
      if (dto.categoryIds?.length) {
        const junctions = dto.categoryIds.map((catId) =>
          manager.create(RecipeCategory, {
            recipeId: savedRecipe.id,
            categoryId: catId,
          }),
        );
        await manager.save(RecipeCategory, junctions);
      }

      // 只返回 ID，不在事务内查询（避免读到未提交数据报 Recipe not found）
      return savedRecipe.id;
    });

    // 事务提交后，用普通连接读取完整详情
    return this.getRecipeDetail(newRecipeId);
  }

  async updateRecipe(id: string, dto: AdminUpdateRecipeDto) {
    const recipe = await this.recipes.findOne({ where: { id } });
    if (!recipe) throw new NotFoundException('Recipe not found');

    return this.dataSource.transaction(async (manager) => {
      // Update scalar fields
      const { ingredients: dtoIngredients, steps: dtoSteps, categoryIds, ...scalarFields } = dto;

      // Only assign defined fields
      const updateData: Partial<Recipe> = {};
      if (scalarFields.title !== undefined) updateData.title = scalarFields.title;
      if (scalarFields.description !== undefined)
        updateData.description = scalarFields.description ?? null;
      if (scalarFields.coverImage !== undefined)
        updateData.coverImage = scalarFields.coverImage ?? null;
      if (scalarFields.categoryId !== undefined)
        updateData.categoryId = scalarFields.categoryId ?? null;
      if (scalarFields.mealSceneId !== undefined)
        updateData.mealSceneId = scalarFields.mealSceneId ?? null;
      if (scalarFields.baseServings !== undefined)
        updateData.baseServings = scalarFields.baseServings;
      if (scalarFields.difficulty !== undefined) updateData.difficulty = scalarFields.difficulty;
      if (scalarFields.totalMinutes !== undefined)
        updateData.totalMinutes = scalarFields.totalMinutes ?? null;
      if (scalarFields.status !== undefined) updateData.status = scalarFields.status;
      if (scalarFields.tags !== undefined) updateData.tags = scalarFields.tags ?? [];
      if (scalarFields.isPublic !== undefined) updateData.isPublic = scalarFields.isPublic;
      if (scalarFields.isFeatured !== undefined) updateData.isFeatured = scalarFields.isFeatured;

      if (Object.keys(updateData).length > 0) {
        await manager.update(Recipe, id, updateData);
      }

      // Replace ingredients if provided
      if (dtoIngredients !== undefined) {
        await manager.delete(RecipeIngredient, { recipeId: id });
        if (dtoIngredients.length > 0) {
          const ingredientEntities = dtoIngredients.map((item, idx) =>
            manager.create(RecipeIngredient, {
              recipeId: id,
              ingredientId: item.ingredientId ?? null,
              customName: item.customName ?? null,
              amount: item.amount,
              unit: item.unit,
              scaleType: item.scaleType ?? 'linear',
              scaleFactor: item.scaleFactor ?? '0.70',
              groupName: item.groupName ?? null,
              notes: item.notes ?? null,
              sort: item.sort ?? idx,
            }),
          );
          await manager.save(RecipeIngredient, ingredientEntities);
        }
      }

      // Replace steps if provided
      if (dtoSteps !== undefined) {
        await manager.delete(RecipeStep, { recipeId: id });
        if (dtoSteps.length > 0) {
          const stepEntities = dtoSteps.map((item) =>
            manager.create(RecipeStep, {
              recipeId: id,
              stepNumber: item.stepNumber,
              description: item.description,
              imageUrl: item.imageUrl ?? null,
              durationSeconds: item.durationSeconds ?? null,
              tips: item.tips ?? null,
            }),
          );
          await manager.save(RecipeStep, stepEntities);
        }
      }

      // Replace category junctions if provided
      if (categoryIds !== undefined) {
        await manager.delete(RecipeCategory, { recipeId: id });
        if (categoryIds.length > 0) {
          const junctions = categoryIds.map((catId) =>
            manager.create(RecipeCategory, {
              recipeId: id,
              categoryId: catId,
            }),
          );
          await manager.save(RecipeCategory, junctions);
        }
      }

      return this.getRecipeDetail(id);
    });
  }

  async batchArchive(ids: string[]) {
    await this.recipes.update({ id: In(ids) }, { status: 'archived' as RecipeStatus });
    return { affected: ids.length };
  }

  async batchDelete(ids: string[]) {
    // Delete related data first (ingredients, steps, categories) then recipe
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(RecipeIngredient, { recipeId: In(ids) });
      await manager.delete(RecipeStep, { recipeId: In(ids) });
      await manager.delete(RecipeCategory, { recipeId: In(ids) });
      await manager.delete(Recipe, { id: In(ids) });
    });
    return { affected: ids.length };
  }

  async setRecipeStatus(id: string, status: RecipeStatus) {
    const recipe = await this.recipes.findOne({ where: { id } });
    if (!recipe) throw new NotFoundException('Recipe not found');
    recipe.status = status;
    return this.recipes.save(recipe);
  }

  async setFeatured(id: string, isFeatured: boolean) {
    const recipe = await this.recipes.findOne({ where: { id } });
    if (!recipe) throw new NotFoundException('Recipe not found');
    recipe.isFeatured = isFeatured;
    // 设为推荐时也自动公开
    if (isFeatured) recipe.isPublic = true;
    return this.recipes.save(recipe);
  }

  async deleteRecipe(id: string) {
    const recipe = await this.recipes.findOne({ where: { id } });
    if (!recipe) throw new NotFoundException('Recipe not found');
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(RecipeIngredient, { recipeId: id });
      await manager.delete(RecipeStep, { recipeId: id });
      await manager.delete(RecipeCategory, { recipeId: id });
      await manager.remove(Recipe, recipe);
    });
    return { id };
  }

  /* ═══════════════════════ Users ═══════════════════════ */

  async listUsers(query: AdminListUsersDto) {
    const { page = 1, pageSize = 20, keyword, role, status, dateFrom, dateTo } = query;

    const qb = this.users
      .createQueryBuilder('u')
      .addSelect(
        (sq) => sq.select('COUNT(*)').from(Recipe, 'r').where('r.authorId = u.id'),
        'recipeCount',
      )
      .addSelect(
        (sq) => sq.select('COUNT(*)').from(CookingLog, 'cl').where('cl.userId = u.id'),
        'cookingCount',
      );

    if (role) qb.andWhere('u.role = :role', { role });
    if (status) qb.andWhere('u.status = :status', { status });
    if (keyword) qb.andWhere('u.nickname ILIKE :keyword', { keyword: `%${keyword}%` });
    if (dateFrom) qb.andWhere('u.createdAt >= :dateFrom', { dateFrom: new Date(dateFrom) });
    if (dateTo) qb.andWhere('u.createdAt <= :dateTo', { dateTo: new Date(dateTo) });

    qb.orderBy('u.createdAt', 'DESC');

    // Get total count first
    const total = await qb.getCount();

    // Then get paginated raw results
    qb.offset((page - 1) * pageSize).limit(pageSize);
    const rawResults = await qb.getRawAndEntities();

    const items = rawResults.entities.map((entity, i) => ({
      ...entity,
      recipeCount: parseInt(rawResults.raw[i].recipeCount ?? '0', 10),
      cookingCount: parseInt(rawResults.raw[i].cookingCount ?? '0', 10),
    }));

    return paginate(items, total, page, pageSize);
  }

  async getUserDetail(id: string) {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    // User's recipes (latest 20)
    const [recentRecipes, recipeTotal] = await this.recipes.findAndCount({
      where: { authorId: id },
      order: { createdAt: 'DESC' },
      take: 20,
    });

    // User's recent cooking logs (latest 20)
    const [recentLogs, logTotal] = await this.logs.findAndCount({
      where: { userId: id },
      order: { cookedAt: 'DESC' },
      take: 20,
    });

    return {
      ...user,
      recipes: { items: recentRecipes, total: recipeTotal },
      cookingLogs: { items: recentLogs, total: logTotal },
    };
  }

  async setUserRole(id: string, role: UserRole) {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    user.role = role;
    return this.users.save(user);
  }

  async setUserStatus(id: string, status: UserStatus) {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    user.status = status;
    return this.users.save(user);
  }

  async setVip(id: string, vipExpiresAt: Date | null) {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    if (vipExpiresAt) {
      user.role = 'vip';
      user.vipExpiresAt = vipExpiresAt;
    } else {
      user.role = 'user';
      user.vipExpiresAt = null;
    }

    return this.users.save(user);
  }

  async deleteUser(id: string) {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    await this.users.remove(user);
    return { id };
  }

  /* ═══════════════════════ Ingredients ═══════════════════════ */

  async listIngredients(query: AdminListIngredientsDto) {
    const { page = 1, pageSize = 20, keyword, categoryId } = query;

    const qb = this.ingredients
      .createQueryBuilder('ing')
      .leftJoin(Category, 'cat', 'cat.id = ing.categoryId')
      .addSelect('cat.name', 'categoryName');

    if (categoryId) qb.andWhere('ing.categoryId = :categoryId', { categoryId });
    if (keyword) qb.andWhere('ing.name ILIKE :keyword', { keyword: `%${keyword}%` });

    qb.orderBy('ing.sort', 'ASC').addOrderBy('ing.name', 'ASC');

    const total = await qb.getCount();
    qb.offset((page - 1) * pageSize).limit(pageSize);

    const rawResults = await qb.getRawAndEntities();
    const items = rawResults.entities.map((entity, i) => ({
      ...entity,
      categoryName: rawResults.raw[i].categoryName ?? null,
    }));

    return paginate(items, total, page, pageSize);
  }

  async getIngredient(id: number) {
    const ingredient = await this.ingredients.findOne({ where: { id } });
    if (!ingredient) throw new NotFoundException('Ingredient not found');

    let categoryName: string | null = null;
    if (ingredient.categoryId) {
      const cat = await this.categories.findOne({ where: { id: ingredient.categoryId } });
      categoryName = cat?.name ?? null;
    }

    return { ...ingredient, categoryName };
  }

  async createIngredient(dto: AdminCreateIngredientDto) {
    const ingredient = this.ingredients.create({
      name: dto.name,
      categoryId: dto.categoryId ?? null,
      defaultUnit: dto.defaultUnit ?? 'g',
      referencePrice: dto.referencePrice ?? null,
      referenceUnit: dto.referenceUnit ?? null,
      imageUrl: dto.imageUrl ?? null,
      defaultScaleType: dto.defaultScaleType ?? 'linear',
      aliases: dto.aliases ?? [],
      calories: dto.calories ?? null,
      sort: dto.sort ?? 0,
    });
    return this.ingredients.save(ingredient);
  }

  async updateIngredient(id: number, dto: AdminUpdateIngredientDto) {
    const ingredient = await this.ingredients.findOne({ where: { id } });
    if (!ingredient) throw new NotFoundException('Ingredient not found');

    if (dto.name !== undefined) ingredient.name = dto.name;
    if (dto.categoryId !== undefined) ingredient.categoryId = dto.categoryId ?? null;
    if (dto.defaultUnit !== undefined) ingredient.defaultUnit = dto.defaultUnit;
    if (dto.referencePrice !== undefined) ingredient.referencePrice = dto.referencePrice ?? null;
    if (dto.referenceUnit !== undefined) ingredient.referenceUnit = dto.referenceUnit ?? null;
    if (dto.imageUrl !== undefined) ingredient.imageUrl = dto.imageUrl ?? null;
    if (dto.defaultScaleType !== undefined) ingredient.defaultScaleType = dto.defaultScaleType;
    if (dto.aliases !== undefined) ingredient.aliases = dto.aliases;
    if (dto.calories !== undefined) ingredient.calories = dto.calories ?? null;
    if (dto.sort !== undefined) ingredient.sort = dto.sort;

    return this.ingredients.save(ingredient);
  }

  /** 批量导入食材（CSV 格式: name,categoryId,defaultUnit,referencePrice,referenceUnit,aliases,calories） */
  async batchImportIngredients(rows: Array<Partial<Ingredient> & { name: string }>) {
    const results = { created: 0, updated: 0, errors: [] as string[] };

    for (const row of rows) {
      try {
        const existing = await this.ingredients.findOne({ where: { name: row.name } });
        if (existing) {
          // Update existing
          if (row.categoryId !== undefined) existing.categoryId = row.categoryId ?? null;
          if (row.defaultUnit) existing.defaultUnit = row.defaultUnit;
          if (row.referencePrice !== undefined)
            existing.referencePrice = row.referencePrice ?? null;
          if (row.referenceUnit !== undefined) existing.referenceUnit = row.referenceUnit ?? null;
          if (row.aliases) existing.aliases = row.aliases;
          if (row.calories !== undefined) existing.calories = row.calories ?? null;
          await this.ingredients.save(existing);
          results.updated++;
        } else {
          const ingredient = this.ingredients.create({
            name: row.name,
            categoryId: row.categoryId ?? null,
            defaultUnit: row.defaultUnit ?? 'g',
            referencePrice: row.referencePrice ?? null,
            referenceUnit: row.referenceUnit ?? null,
            aliases: row.aliases ?? [],
            calories: row.calories ?? null,
            sort: row.sort ?? 0,
          });
          await this.ingredients.save(ingredient);
          results.created++;
        }
      } catch (err: any) {
        results.errors.push(`"${row.name}": ${err.message}`);
      }
    }

    return results;
  }

  async deleteIngredient(id: number) {
    const ingredient = await this.ingredients.findOne({ where: { id } });
    if (!ingredient) throw new NotFoundException('Ingredient not found');
    await this.ingredients.remove(ingredient);
    return { id };
  }

  /* ═══════════════════════ Categories ═══════════════════════ */

  async listCategories(query: AdminListCategoriesDto) {
    const { page = 1, pageSize = 20, keyword, type } = query;

    const qb = this.categories.createQueryBuilder('cat').where('cat.ownerId IS NULL'); // system categories only

    if (type) qb.andWhere('cat.type = :type', { type });
    if (keyword) qb.andWhere('cat.name ILIKE :keyword', { keyword: `%${keyword}%` });

    qb.orderBy('cat.sort', 'ASC').addOrderBy('cat.name', 'ASC');

    const total = await qb.getCount();
    qb.offset((page - 1) * pageSize).limit(pageSize);
    const items = await qb.getMany();

    return paginate(items, total, page, pageSize);
  }

  async createCategory(dto: AdminCreateCategoryDto) {
    const category = this.categories.create({
      type: dto.type,
      name: dto.name,
      icon: dto.icon ?? null,
      sort: dto.sort ?? 0,
      ownerId: null, // system category
    });
    return this.categories.save(category);
  }

  async updateCategory(id: number, dto: AdminUpdateCategoryDto) {
    const category = await this.categories.findOne({
      where: { id, ownerId: IsNull() },
    });
    if (!category) throw new NotFoundException('System category not found');

    if (dto.name !== undefined) category.name = dto.name;
    if (dto.icon !== undefined) category.icon = dto.icon ?? null;
    if (dto.sort !== undefined) category.sort = dto.sort;
    if (dto.enabled !== undefined) category.enabled = dto.enabled;

    return this.categories.save(category);
  }

  async setCategoryEnabled(id: number, enabled: boolean) {
    const category = await this.categories.findOne({
      where: { id, ownerId: IsNull() },
    });
    if (!category) throw new NotFoundException('System category not found');
    category.enabled = enabled;
    return this.categories.save(category);
  }

  async deleteCategory(id: number) {
    const category = await this.categories.findOne({
      where: { id, ownerId: IsNull() },
    });
    if (!category) throw new NotFoundException('System category not found');
    await this.categories.remove(category);
    return { id };
  }

  async reorderCategories(dto: ReorderCategoriesDto) {
    await this.dataSource.transaction(async (manager) => {
      for (const item of dto.items) {
        await manager.update(Category, item.id, { sort: item.sort });
      }
    });
    return { affected: dto.items.length };
  }
}

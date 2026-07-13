import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { calculateScaledAmount, roundAmount } from '../../common/utils/scaling-calculator';
import {
  EngineIngredient,
  ScaleSpec,
  ScalingProfile,
  ScalingRole,
  scaleRecipe,
} from '../../common/utils/scaling-engine';
import { RecipeIngredient } from './entities/recipe-ingredient.entity';
import { Recipe } from './entities/recipe.entity';

export interface ScaledIngredientItem {
  id: number;
  ingredientId: number | null;
  customName: string | null;
  groupName: string | null;
  unit: string;
  originalAmount: number;
  scaledAmount: number;
  scaleType: 'linear' | 'sub_linear' | 'fixed';
  scaleFactor: number;
  notes: string | null;
  sort: number;
}

export interface ScaleResult {
  recipeId: string;
  title: string;
  baseServings: number;
  targetServings: number;
  multiplier: number;
  ingredients: ScaledIngredientItem[];
}

/** scaleWithSpec 的单条结果：引擎缩放量 + 回挂 DB 身份字段 */
export interface EngineScaledItem {
  id: number;
  ingredientId: number | null;
  customName: string | null;
  groupName: string | null;
  unit: string;
  scalingRole: ScalingRole | null;
  originalAmount: number;
  scaledAmount: number;
}

export interface SpecScaleResult {
  recipeId: string;
  title: string;
  scalingProfile: ScalingProfile;
  ingredients: EngineScaledItem[];
}

/** decimal 字段 TypeORM 返回 string；null → undefined，绝不产生 NaN */
function toNum(v: string | null | undefined): number | undefined {
  return v == null ? undefined : parseFloat(v);
}

/**
 * DB 行 → 引擎输入。所有 decimal 一律 parseFloat（铁律）。
 * role 为 legacy 行的 null 时传 undefined（引擎按"非 anchor/非 fixed"处理，
 * 不兜底成 'fixed' 以免静默吞错）。按 (sort, id) 排序，与 legacy 一致。
 */
export function toEngineIngredients(rows: RecipeIngredient[]): EngineIngredient[] {
  return rows
    .slice()
    .sort((a, b) => a.sort - b.sort || a.id - b.id)
    .map((ri) => ({
      id: ri.id,
      name: ri.customName ?? undefined,
      amount: parseFloat(ri.amount),
      unit: ri.unit,
      role: (ri.scalingRole ?? undefined) as ScalingRole,
      percentageValue: toNum(ri.percentageValue),
      ratioGroup: ri.ratioGroup ?? undefined,
      ratioValue: toNum(ri.ratioValue),
      correction: ri.correction ?? undefined,
      scaleType: ri.scaleType,
      scaleFactor: parseFloat(ri.scaleFactor),
      roundDp: ri.roundDp ?? undefined,
    }));
}

@Injectable()
export class ScalingService {
  constructor(@InjectRepository(Recipe) private readonly recipes: Repository<Recipe>) {}

  /**
   * 按份数缩放（controller GET + cooking + stock-deduction 调用）。
   * linear_legacy 逐字节保持原有逻辑；非 legacy profile 需按锚点/锁定量缩放，
   * 用 scaleWithSpec（下一片 POST /:id/scale）。
   */
  async scale(recipeId: string, targetServings: number): Promise<ScaleResult> {
    if (targetServings <= 0) {
      throw new BadRequestException('targetServings must be > 0');
    }
    const recipe = await this.recipes.findOne({
      where: { id: recipeId },
      relations: ['ingredients'],
    });
    if (!recipe) throw new NotFoundException('Recipe not found');

    const profile = recipe.scalingProfile ?? 'linear_legacy';
    if (profile !== 'linear_legacy') {
      throw new BadRequestException(
        `Profile "${profile}" scales by anchor/locked amounts — use the locked-scale endpoint (POST /:id/scale)`,
      );
    }

    // —— 以下 linear_legacy 逻辑逐字节保留现状 ——
    const multiplier = targetServings / recipe.baseServings;
    const ingredients = recipe.ingredients
      .slice()
      .sort((a, b) => a.sort - b.sort || a.id - b.id)
      .map<ScaledIngredientItem>((ri) => {
        const original = parseFloat(ri.amount);
        const factor = parseFloat(ri.scaleFactor);
        const scaled = calculateScaledAmount(original, multiplier, ri.scaleType, factor);
        return {
          id: ri.id,
          ingredientId: ri.ingredientId,
          customName: ri.customName,
          groupName: ri.groupName,
          unit: ri.unit,
          originalAmount: original,
          scaledAmount: roundAmount(scaled),
          scaleType: ri.scaleType,
          scaleFactor: factor,
          notes: ri.notes,
          sort: ri.sort,
        };
      });

    return {
      recipeId: recipe.id,
      title: recipe.title,
      baseServings: recipe.baseServings,
      targetServings,
      multiplier: Math.round(multiplier * 1000) / 1000,
      ingredients,
    };
  }

  /**
   * 锁定式缩放：按传入 ScaleSpec 分派到引擎 scaleRecipe。
   * 下一片 POST /:id/scale 调用；四个 profile 均走此路。
   */
  async scaleWithSpec(recipeId: string, spec: ScaleSpec): Promise<SpecScaleResult> {
    const recipe = await this.recipes.findOne({
      where: { id: recipeId },
      relations: ['ingredients'],
    });
    if (!recipe) throw new NotFoundException('Recipe not found');

    const engineOut = scaleRecipe(toEngineIngredients(recipe.ingredients), spec);
    const byId = new Map(recipe.ingredients.map((ri) => [ri.id, ri]));

    const ingredients: EngineScaledItem[] = engineOut.map((o) => {
      const ri = byId.get(o.id as number);
      return {
        id: o.id as number,
        ingredientId: ri?.ingredientId ?? null,
        customName: ri?.customName ?? null,
        groupName: ri?.groupName ?? null,
        unit: o.unit,
        scalingRole: ri?.scalingRole ?? null,
        originalAmount: o.originalAmount,
        scaledAmount: o.scaledAmount,
      };
    });

    return {
      recipeId: recipe.id,
      title: recipe.title,
      scalingProfile: recipe.scalingProfile ?? 'linear_legacy',
      ingredients,
    };
  }
}

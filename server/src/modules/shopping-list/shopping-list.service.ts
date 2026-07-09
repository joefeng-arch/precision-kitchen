import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { Recipe } from '../recipes/entities/recipe.entity';
import { Ingredient } from '../ingredients/entities/ingredient.entity';
import { UserIngredient } from '../ingredients/entities/user-ingredient.entity';
import { Category } from '../categories/entities/category.entity';
import { calculateScaledAmount, roundAmount } from '../../common/utils/scaling-calculator';
import { toBase, getCategory as getUnitCategory } from '../../common/utils/unit-converter';

// ─── Response types ──────────────────────────────────────────

export interface ShoppingIngredient {
  /** ingredient table id, null if custom-name only */
  ingredientId: number | null;
  /** display name */
  name: string;
  /** aggregated amount (after scaling + unit conversion) */
  amount: number;
  /** display unit */
  unit: string;
  /** estimated cost (¥) or null if no price data */
  cost: number | null;
  /** which recipes contributed to this row */
  sourceRecipes: string[];
  /** user has this item in stock */
  inStock: boolean;
  /** user's current stock amount (converted to same unit) */
  stockAmount: number | null;
  /** how much extra the user needs to buy (amount - stockAmount, floored at 0) */
  deficit: number | null;
}

export interface ShoppingGroup {
  categoryId: number | null;
  categoryName: string;
  categoryIcon: string | null;
  items: ShoppingIngredient[];
}

export interface ShoppingListResult {
  groups: ShoppingGroup[];
  totalCost: number | null;
  sourceRecipes: { recipeId: string; title: string; servings: number }[];
}

// ─── Service ─────────────────────────────────────────────────

@Injectable()
export class ShoppingListService {
  private readonly logger = new Logger(ShoppingListService.name);

  constructor(
    @InjectRepository(Recipe)
    private readonly recipeRepo: Repository<Recipe>,
    @InjectRepository(Ingredient)
    private readonly ingredientRepo: Repository<Ingredient>,
    @InjectRepository(UserIngredient)
    private readonly userIngredientRepo: Repository<UserIngredient>,
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
  ) {}

  async generate(
    userId: string,
    items: { recipeId: string; servings: number }[],
  ): Promise<ShoppingListResult> {
    // 1. Load all requested recipes with ingredients
    const recipeIds = items.map((i) => i.recipeId);
    const recipes = await this.recipeRepo.find({
      where: { id: In(recipeIds) },
      relations: ['ingredients'],
    });

    const recipeMap = new Map(recipes.map((r) => [r.id, r]));
    for (const item of items) {
      if (!recipeMap.has(item.recipeId)) {
        throw new NotFoundException(`菜谱 ${item.recipeId} 不存在`);
      }
    }

    // 2. Build aggregation map: key = ingredientId or "custom:name"
    // value = { name, amount (in base unit), unit, ingredientId, sourceRecipes }
    const aggMap = new Map<
      string,
      {
        ingredientId: number | null;
        name: string;
        baseAmount: number; // in grams or ml
        baseUnit: string; // 'g' or 'ml'
        rawAmount: number; // for non-convertible units, accumulate raw
        rawUnit: string;
        sourceRecipes: Set<string>;
        useBase: boolean; // whether we successfully converted to base unit
      }
    >();

    const sourceRecipesMeta: ShoppingListResult['sourceRecipes'] = [];

    for (const item of items) {
      const recipe = recipeMap.get(item.recipeId)!;
      sourceRecipesMeta.push({
        recipeId: recipe.id,
        title: recipe.title,
        servings: item.servings,
      });

      const multiplier = item.servings / recipe.baseServings;

      for (const ri of recipe.ingredients) {
        const originalAmount = parseFloat(ri.amount);
        const factor = parseFloat(ri.scaleFactor);
        const scaled = calculateScaledAmount(originalAmount, multiplier, ri.scaleType, factor);

        const key = ri.ingredientId
          ? `id:${ri.ingredientId}`
          : `custom:${(ri.customName || '').toLowerCase().trim()}`;

        const name = ri.customName || `ingredient#${ri.ingredientId}`;

        const existing = aggMap.get(key);

        // Try to convert to base unit for aggregation
        const converted = toBase(scaled, ri.unit);

        if (existing) {
          existing.sourceRecipes.add(recipe.title);
          if (existing.useBase && converted) {
            // Both can be converted — aggregate in base unit
            existing.baseAmount += converted.value;
          } else if (!existing.useBase && !converted) {
            // Both unconvertible — just add raw if same unit
            if (existing.rawUnit === ri.unit) {
              existing.rawAmount += scaled;
            } else {
              // Different unconvertible units — store as separate row
              const altKey = `${key}:${ri.unit}`;
              const altExisting = aggMap.get(altKey);
              if (altExisting) {
                altExisting.rawAmount += scaled;
                altExisting.sourceRecipes.add(recipe.title);
              } else {
                aggMap.set(altKey, {
                  ingredientId: ri.ingredientId,
                  name,
                  baseAmount: 0,
                  baseUnit: 'g',
                  rawAmount: scaled,
                  rawUnit: ri.unit,
                  sourceRecipes: new Set([recipe.title]),
                  useBase: false,
                });
              }
              continue;
            }
          } else {
            // Mismatch: one convertible, one not. Add raw separately
            const altKey = `${key}:${ri.unit}`;
            const altExisting = aggMap.get(altKey);
            if (altExisting) {
              altExisting.rawAmount += scaled;
              altExisting.sourceRecipes.add(recipe.title);
            } else {
              aggMap.set(altKey, {
                ingredientId: ri.ingredientId,
                name,
                baseAmount: converted ? converted.value : 0,
                baseUnit: converted ? converted.baseUnit : 'g',
                rawAmount: converted ? 0 : scaled,
                rawUnit: ri.unit,
                sourceRecipes: new Set([recipe.title]),
                useBase: Boolean(converted),
              });
            }
            continue;
          }
        } else {
          aggMap.set(key, {
            ingredientId: ri.ingredientId,
            name,
            baseAmount: converted ? converted.value : 0,
            baseUnit: converted ? converted.baseUnit : 'g',
            rawAmount: converted ? 0 : scaled,
            rawUnit: ri.unit,
            sourceRecipes: new Set([recipe.title]),
            useBase: Boolean(converted),
          });
        }
      }
    }

    // 3. Load ingredient catalog data (names, categories, reference prices)
    const ingredientIds = [...aggMap.values()]
      .map((v) => v.ingredientId)
      .filter((id): id is number => id !== null);

    const ingredients = ingredientIds.length
      ? await this.ingredientRepo.find({ where: { id: In([...new Set(ingredientIds)]) } })
      : [];
    const ingredientMap = new Map(ingredients.map((i) => [i.id, i]));

    // 4. Load user's stock
    const userStock = await this.userIngredientRepo.find({
      where: { userId },
    });
    // Build stock lookup: ingredientId → UserIngredient, customName → UserIngredient
    const stockByIngredientId = new Map<number, UserIngredient>();
    const stockByName = new Map<string, UserIngredient>();
    for (const ui of userStock) {
      if (ui.ingredientId) stockByIngredientId.set(ui.ingredientId, ui);
      if (ui.customName) stockByName.set(ui.customName.toLowerCase().trim(), ui);
    }

    // 5. Load categories
    const categoryIds = new Set<number>();
    for (const ing of ingredients) {
      if (ing.categoryId) categoryIds.add(ing.categoryId);
    }
    const categories = categoryIds.size
      ? await this.categoryRepo.find({
          where: { id: In([...categoryIds]) },
        })
      : [];
    const categoryMap = new Map(categories.map((c) => [c.id, c]));

    // 6. Build result groups
    const groupMap = new Map<number | null, ShoppingIngredient[]>();
    let totalCost: number | null = 0;

    for (const agg of aggMap.values()) {
      // Resolve display name from catalog
      const catalogEntry = agg.ingredientId ? ingredientMap.get(agg.ingredientId) : null;
      const displayName = catalogEntry?.name || agg.name;
      const catId = catalogEntry?.categoryId ?? null;

      // Determine final display amount and unit
      let displayAmount: number;
      let displayUnit: string;
      if (agg.useBase) {
        // Convert back to friendly unit
        displayAmount = roundAmount(agg.baseAmount);
        displayUnit = agg.baseUnit;
        // Try to display in a friendlier unit
        if (agg.baseUnit === 'g' && agg.baseAmount >= 1000) {
          displayAmount = roundAmount(agg.baseAmount / 1000);
          displayUnit = 'kg';
        } else if (agg.baseUnit === 'ml' && agg.baseAmount >= 1000) {
          displayAmount = roundAmount(agg.baseAmount / 1000);
          displayUnit = 'L';
        }
      } else {
        displayAmount = roundAmount(agg.rawAmount);
        displayUnit = agg.rawUnit;
      }

      // Check stock
      const stockEntry = agg.ingredientId
        ? stockByIngredientId.get(agg.ingredientId)
        : stockByName.get(agg.name.toLowerCase().trim());

      let inStock = false;
      let stockAmount: number | null = null;
      let deficit: number | null = null;

      if (stockEntry && stockEntry.stockAmount != null && stockEntry.stockUnit) {
        const userAmount = parseFloat(stockEntry.stockAmount);
        // Try to convert user stock to same base unit
        if (agg.useBase) {
          const stockConverted = toBase(userAmount, stockEntry.stockUnit);
          if (stockConverted && stockConverted.baseUnit === agg.baseUnit) {
            // Convert stock to display unit
            if (displayUnit === 'kg') {
              stockAmount = roundAmount(stockConverted.value / 1000);
            } else if (displayUnit === 'L') {
              stockAmount = roundAmount(stockConverted.value / 1000);
            } else {
              stockAmount = roundAmount(stockConverted.value);
            }
            deficit = roundAmount(Math.max(0, displayAmount - stockAmount));
            inStock = deficit === 0;
          }
        } else if (stockEntry.stockUnit === displayUnit) {
          stockAmount = roundAmount(userAmount);
          deficit = roundAmount(Math.max(0, displayAmount - stockAmount));
          inStock = deficit === 0;
        }
      }

      // Estimate cost
      let cost: number | null = null;
      // Prefer user's unit price, fallback to reference price
      if (stockEntry && stockEntry.unitPrice) {
        const userPrice = parseFloat(stockEntry.unitPrice);
        const priceUnit = stockEntry.priceUnit;
        // unitPrice is per priceUnit. Convert needed amount to priceUnit.
        if (agg.useBase) {
          const priceInBase = toBase(1, priceUnit);
          if (priceInBase && priceInBase.baseUnit === agg.baseUnit) {
            // cost = amount_in_base * (unitPrice / priceUnit_in_base)
            cost = roundCost((agg.baseAmount * userPrice) / priceInBase.value);
          }
        }
      }
      if (cost === null && catalogEntry?.referencePrice && catalogEntry.referenceUnit) {
        const refPrice = parseFloat(catalogEntry.referencePrice);
        const refConverted = toBase(1, catalogEntry.referenceUnit);
        if (agg.useBase && refConverted && refConverted.baseUnit === agg.baseUnit) {
          cost = roundCost((agg.baseAmount * refPrice) / refConverted.value);
        }
      }

      if (cost !== null && totalCost !== null) {
        totalCost += cost;
      } else if (cost === null) {
        // Can't compute total if any item missing price
        // We still show partial — set totalCost to null to indicate incomplete
        // Actually let's keep accumulating what we can
      }

      const item: ShoppingIngredient = {
        ingredientId: agg.ingredientId,
        name: displayName,
        amount: displayAmount,
        unit: displayUnit,
        cost,
        sourceRecipes: [...agg.sourceRecipes],
        inStock,
        stockAmount,
        deficit,
      };

      if (!groupMap.has(catId)) {
        groupMap.set(catId, []);
      }
      groupMap.get(catId)!.push(item);
    }

    // 7. Build groups array sorted by category
    const groups: ShoppingGroup[] = [];
    for (const [catId, groupItems] of groupMap) {
      const cat = catId ? categoryMap.get(catId) : null;
      groups.push({
        categoryId: catId,
        categoryName: cat?.name ?? '其他',
        categoryIcon: cat?.icon ?? null,
        items: groupItems.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN')),
      });
    }
    // Sort groups: named categories first, then "其他"
    groups.sort((a, b) => {
      if (a.categoryId === null) return 1;
      if (b.categoryId === null) return -1;
      return a.categoryName.localeCompare(b.categoryName, 'zh-CN');
    });

    if (totalCost !== null) {
      totalCost = roundCost(totalCost);
    }

    return { groups, totalCost, sourceRecipes: sourceRecipesMeta };
  }
}

function roundCost(v: number): number {
  return Math.round(v * 100) / 100;
}

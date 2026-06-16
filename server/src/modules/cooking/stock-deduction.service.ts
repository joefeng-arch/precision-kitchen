import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { In } from 'typeorm';
import { Ingredient } from '../ingredients/entities/ingredient.entity';
import { UserIngredient } from '../ingredients/entities/user-ingredient.entity';
import { ScalingService, ScaledIngredientItem } from '../recipes/scaling.service';
import { CanonicalUnit, normalizeUnit, prettyAmount } from './unit-converter';

export type MatchStatus =
  | 'ok'              // 匹配且库存足够
  | 'short'           // 匹配但库存不足
  | 'unit_mismatch'   // 匹配到食材但单位无法换算
  | 'no_stock'        // 匹配到食材但未填库存
  | 'unmatched';      // 食材库里没有这个食材

export interface IngredientMatch {
  recipe: {
    name: string;
    amount: number;       // 菜谱用量（canonical）
    displayAmount: string; // 友好展示
    unit: CanonicalUnit | string;
  };
  userIngredient?: {
    id: number;
    name: string;
    stockAmount: number;        // 当前库存（canonical）
    stockUnit: CanonicalUnit | string;
    displayStock: string;
    unitPrice: number;          // 单价（按 priceUnit）
    priceUnit: string;
  };
  status: MatchStatus;
  deficit?: number;     // canonical 单位下的缺口
  estimatedCost?: number; // 这一项的估算成本（CNY）
}

export interface DeductionPreview {
  matches: IngredientMatch[];
  hasShortage: boolean;
  totalEstimatedCost: number;
}

export interface DeductionResult extends DeductionPreview {
  deducted: Array<{
    userIngredientId: number;
    name: string;
    deductedAmount: number;
    canonicalUnit: CanonicalUnit;
    displayAmount: string;
    estimatedCost: number;
  }>;
  undoToken: string;   // 客户端用这个调撤销
  undoExpiresAt: string; // ISO 时间戳
}

interface UndoSnapshot {
  userId: string;
  logId: string;
  entries: Array<{
    userIngredientId: number;
    previousStockAmount: string | null;
    previousStockUnit: string | null;
  }>;
}

const UNDO_TTL_MS = 30 * 1000;

@Injectable()
export class StockDeductionService {
  constructor(
    @InjectRepository(UserIngredient)
    private readonly userIngredients: Repository<UserIngredient>,
    @InjectRepository(Ingredient)
    private readonly publicIngs: Repository<Ingredient>,
    private readonly scaling: ScalingService,
    private readonly ds: DataSource,
    @Inject(CACHE_MANAGER) private readonly cache: any,
  ) {}

  /** 批量加载公共库食材名映射；用于把 ingredientId 渲染成名字 */
  private async loadPublicNames(ids: number[]): Promise<Map<number, string>> {
    const unique = Array.from(new Set(ids.filter((v): v is number => typeof v === 'number')));
    if (!unique.length) return new Map();
    const rows = await this.publicIngs.find({ where: { id: In(unique) } });
    return new Map(rows.map((r) => [r.id, r.name]));
  }

  /** 烹饪开始前/完成时调用，给前端列出匹配情况 + 缺口 */
  async preview(userId: string, recipeId: string, servings: number): Promise<DeductionPreview> {
    const scaled = await this.scaling.scale(recipeId, servings);
    const pantry = await this.userIngredients.find({ where: { userId } });
    const ingIds = [
      ...scaled.ingredients.map((i) => i.ingredientId).filter((v): v is number => typeof v === 'number'),
      ...pantry.map((p) => p.ingredientId).filter((v): v is number => typeof v === 'number'),
    ];
    const nameMap = await this.loadPublicNames(ingIds);
    return this.buildPreview(scaled.ingredients, pantry, nameMap);
  }

  /** 实际扣减；写 Redis undo snapshot；返回回执 */
  async deduct(
    userId: string,
    logId: string,
    recipeId: string,
    servings: number,
  ): Promise<DeductionResult> {
    const scaled = await this.scaling.scale(recipeId, servings);
    const preview = await this.ds.transaction(async (mgr) => {
      const repo = mgr.getRepository(UserIngredient);
      const pantry = await repo.find({ where: { userId } });
      const ingIds = [
        ...scaled.ingredients.map((i) => i.ingredientId).filter((v): v is number => typeof v === 'number'),
        ...pantry.map((p) => p.ingredientId).filter((v): v is number => typeof v === 'number'),
      ];
      const nameMap = await this.loadPublicNames(ingIds);
      const built = this.buildPreview(scaled.ingredients, pantry, nameMap);

      const deducted: DeductionResult['deducted'] = [];
      const snapshotEntries: UndoSnapshot['entries'] = [];

      for (const m of built.matches) {
        if (m.status !== 'ok' && m.status !== 'short') continue;
        if (!m.userIngredient) continue;

        // 找到 entity
        const entity = pantry.find((p) => p.id === m.userIngredient!.id);
        if (!entity) continue;

        // 当前库存 → canonical
        const currentNorm = normalizeUnit(Number(entity.stockAmount), entity.stockUnit);
        if (!currentNorm) continue;

        // 实际扣减量 = min(需要量, 现有量)
        const required = m.recipe.amount;
        const realDeduct = Math.min(required, currentNorm.amount);
        const newAmount = Math.max(0, currentNorm.amount - realDeduct);

        // 写回 entity（保留原单位的话需要换算回去；这里简化为统一存 canonical 单位）
        snapshotEntries.push({
          userIngredientId: entity.id,
          previousStockAmount: entity.stockAmount,
          previousStockUnit: entity.stockUnit,
        });

        entity.stockAmount = newAmount.toFixed(2);
        entity.stockUnit = currentNorm.unit; // 扣减后统一用 canonical 单位（避免 2斤 - 200g 这种混乱）
        await repo.save(entity);

        deducted.push({
          userIngredientId: entity.id,
          name: m.userIngredient.name,
          deductedAmount: Math.round(realDeduct * 100) / 100,
          canonicalUnit: currentNorm.unit,
          displayAmount: prettyAmount({ amount: realDeduct, unit: currentNorm.unit }),
          estimatedCost: m.estimatedCost ?? 0,
        });
      }

      return { built, deducted, snapshotEntries };
    });

    // Redis undo snapshot（事务外写，事务内写也行但 cache-manager 不在事务里）
    const undoToken = `undo:${userId}:${logId}`;
    const snapshot: UndoSnapshot = {
      userId,
      logId,
      entries: preview.snapshotEntries,
    };
    await this.cache.set(undoToken, snapshot, UNDO_TTL_MS);

    return {
      ...preview.built,
      deducted: preview.deducted,
      undoToken,
      undoExpiresAt: new Date(Date.now() + UNDO_TTL_MS).toISOString(),
    };
  }

  /** 30 秒内撤销扣减：把 stockAmount / stockUnit 恢复为快照值 */
  async undo(userId: string, undoToken: string): Promise<{ restored: number }> {
    const snap = (await this.cache.get(undoToken)) as UndoSnapshot | null;
    if (!snap) {
      throw new NotFoundException('撤销已超时或不存在');
    }
    if (snap.userId !== userId) {
      throw new NotFoundException('撤销已超时或不存在');
    }

    let restored = 0;
    await this.ds.transaction(async (mgr) => {
      const repo = mgr.getRepository(UserIngredient);
      for (const e of snap.entries) {
        const item = await repo.findOne({ where: { id: e.userIngredientId, userId } });
        if (!item) continue;
        item.stockAmount = e.previousStockAmount;
        item.stockUnit = e.previousStockUnit;
        await repo.save(item);
        restored++;
      }
    });

    await this.cache.del(undoToken);
    return { restored };
  }

  // ---------- 内部 ----------

  private buildPreview(
    scaledIngredients: ScaledIngredientItem[],
    pantry: UserIngredient[],
    nameMap: Map<number, string> = new Map(),
  ): DeductionPreview {
    const matches: IngredientMatch[] = [];
    let totalCost = 0;

    for (const si of scaledIngredients) {
      const recipeName =
        si.customName ||
        (si.ingredientId != null ? nameMap.get(si.ingredientId) ?? `食材#${si.ingredientId}` : '未命名');
      const recipeNorm = normalizeUnit(si.scaledAmount, si.unit);

      // 1) 优先 ingredientId 精确匹配
      let matched: UserIngredient | undefined;
      if (si.ingredientId != null) {
        matched = pantry.find((p) => p.ingredientId === si.ingredientId);
      }
      // 2) 退化 customName 模糊匹配（去空格 + 小写）
      //    既匹配 pantry.customName，也匹配 pantry.ingredientId 对应的公共名
      if (!matched && si.customName) {
        const key = normName(si.customName);
        matched = pantry.find((p) => {
          if (p.customName && normName(p.customName) === key) return true;
          if (p.ingredientId != null) {
            const pubName = nameMap.get(p.ingredientId);
            if (pubName && normName(pubName) === key) return true;
          }
          return false;
        });
      }
      // 3) 反向：si.ingredientId 已知 → 拿公共名再匹配 pantry.customName
      if (!matched && si.ingredientId != null) {
        const pubName = nameMap.get(si.ingredientId);
        if (pubName) {
          const key = normName(pubName);
          matched = pantry.find((p) => p.customName && normName(p.customName) === key);
        }
      }

      if (!matched) {
        matches.push({
          recipe: {
            name: recipeName,
            amount: recipeNorm?.amount ?? si.scaledAmount,
            displayAmount: recipeNorm ? prettyAmount(recipeNorm) : `${si.scaledAmount}${si.unit}`,
            unit: recipeNorm?.unit ?? si.unit,
          },
          status: 'unmatched',
        });
        continue;
      }

      const userName =
        matched.customName ||
        (matched.ingredientId != null
          ? nameMap.get(matched.ingredientId) ?? `食材#${matched.ingredientId}`
          : `食材#${matched.id}`);
      const unitPrice = Number(matched.unitPrice);

      if (matched.stockAmount == null || matched.stockUnit == null) {
        matches.push({
          recipe: {
            name: recipeName,
            amount: recipeNorm?.amount ?? si.scaledAmount,
            displayAmount: recipeNorm ? prettyAmount(recipeNorm) : `${si.scaledAmount}${si.unit}`,
            unit: recipeNorm?.unit ?? si.unit,
          },
          userIngredient: {
            id: matched.id,
            name: userName,
            stockAmount: 0,
            stockUnit: matched.stockUnit ?? '',
            displayStock: '未填库存',
            unitPrice,
            priceUnit: matched.priceUnit,
          },
          status: 'no_stock',
        });
        continue;
      }

      const stockNorm = normalizeUnit(Number(matched.stockAmount), matched.stockUnit);

      if (!recipeNorm || !stockNorm || recipeNorm.unit !== stockNorm.unit) {
        matches.push({
          recipe: {
            name: recipeName,
            amount: si.scaledAmount,
            displayAmount: `${si.scaledAmount}${si.unit}`,
            unit: si.unit,
          },
          userIngredient: {
            id: matched.id,
            name: userName,
            stockAmount: Number(matched.stockAmount),
            stockUnit: matched.stockUnit,
            displayStock: `${matched.stockAmount}${matched.stockUnit}`,
            unitPrice,
            priceUnit: matched.priceUnit,
          },
          status: 'unit_mismatch',
        });
        continue;
      }

      // 单位 OK，比较数量
      const ok = stockNorm.amount >= recipeNorm.amount;
      // 估算成本：用单价 × 实际扣减量（要按 priceUnit 换算）
      const realDeduct = Math.min(recipeNorm.amount, stockNorm.amount);
      const priceNorm = normalizeUnit(1, matched.priceUnit);
      // priceUnit 也得能 normalize 才能算成本，否则按 0
      let cost = 0;
      if (priceNorm && priceNorm.unit === recipeNorm.unit) {
        // unitPrice 是「每 1 priceUnit 的钱」；换算成「每 1 canonical 的钱」= unitPrice / priceNorm.amount
        const pricePerCanonical = unitPrice / priceNorm.amount;
        cost = pricePerCanonical * realDeduct;
      }
      totalCost += cost;

      matches.push({
        recipe: {
          name: recipeName,
          amount: recipeNorm.amount,
          displayAmount: prettyAmount(recipeNorm),
          unit: recipeNorm.unit,
        },
        userIngredient: {
          id: matched.id,
          name: userName,
          stockAmount: stockNorm.amount,
          stockUnit: stockNorm.unit,
          displayStock: prettyAmount(stockNorm),
          unitPrice,
          priceUnit: matched.priceUnit,
        },
        status: ok ? 'ok' : 'short',
        deficit: ok ? 0 : recipeNorm.amount - stockNorm.amount,
        estimatedCost: Math.round(cost * 100) / 100,
      });
    }

    // hasShortage 含义：任何「按菜谱用量算扣不全」的情况都算
    // - short          匹配上了但库存不够
    // - unmatched      食材库里压根没这个食材
    // - no_stock       匹配上但 stockAmount=null（用户没填库存）
    // - unit_mismatch  匹配但单位换算不了（比如菜谱要 g、库存填了 个）
    return {
      matches,
      hasShortage: matches.some(
        (m) =>
          m.status === 'short' ||
          m.status === 'unmatched' ||
          m.status === 'no_stock' ||
          m.status === 'unit_mismatch',
      ),
      totalEstimatedCost: Math.round(totalCost * 100) / 100,
    };
  }
}

function normName(s: string): string {
  return s.replace(/\s+/g, '').toLowerCase();
}

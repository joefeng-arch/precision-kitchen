import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { convert } from '../../common/utils/unit-converter';
import { Ingredient } from '../ingredients/entities/ingredient.entity';
import { UserIngredient } from '../ingredients/entities/user-ingredient.entity';
import { CostSource } from './entities/cooking-log-cost.entity';
import { normName } from './unit-converter';

/** calculate() 实际消费的最小结构；ScaledIngredientItem / EngineScaledItem 均结构兼容 */
export interface CostableItem {
  ingredientId: number | null;
  customName: string | null;
  scaledAmount: number;
  unit: string;
}

export interface CostLine {
  ingredientId: number | null;
  name: string;
  amount: number;
  unit: string;
  unitPrice: number | null;
  priceUnit: string | null;
  totalCost: number;
  source: CostSource;
}

export interface CostBreakdown {
  currency: string;
  totalCost: number;
  lines: CostLine[];
  unknownCount: number;
}

@Injectable()
export class CostCalculatorService {
  constructor(
    @InjectRepository(UserIngredient)
    private readonly userIngs: Repository<UserIngredient>,
    @InjectRepository(Ingredient)
    private readonly publicIngs: Repository<Ingredient>,
    private readonly config: ConfigService,
  ) {}

  async calculate(userId: string, scaled: CostableItem[]): Promise<CostBreakdown> {
    const currency = this.config.get<string>('COST_CURRENCY', 'CNY');
    const lineIds = scaled.map((s) => s.ingredientId).filter((v): v is number => v !== null);

    // 全量 pantry（个人库量级小；id ASC 让下面的先占策略确定性）——
    // 名称兜底匹配需要看到用户的所有条目，不只 line ids 命中的那些
    const userLib = await this.userIngs.find({ where: { userId }, order: { id: 'ASC' } });

    // 公共名要同时覆盖：行侧（resolveName / 方向③）+ pantry 侧（方向②：关联条目的公共名做键）
    const pantryLinkedIds = userLib
      .map((u) => u.ingredientId)
      .filter((v): v is number => v !== null);
    const publicIds = Array.from(new Set([...lineIds, ...pantryLinkedIds]));
    const publicLib = publicIds.length
      ? await this.publicIngs.find({ where: { id: In(publicIds) } })
      : [];

    const publicById = new Map<number, Ingredient>(publicLib.map((p) => [p.id, p]));

    // 两级索引，先占不覆盖（id 最小赢）：
    //   userByIngId — ingredientId 精确匹配（原有语义）
    //   userByName  — 归一化名称全等兜底（AI 导入的 customName 行靠它吃到用户价；
    //                 键 = pantry.customName ∪ pantry 关联公共名，与 stock-deduction 同策略）
    const userByIngId = new Map<number, UserIngredient>();
    const userByName = new Map<string, UserIngredient>();
    for (const u of userLib) {
      if (u.ingredientId !== null && !userByIngId.has(u.ingredientId)) {
        userByIngId.set(u.ingredientId, u);
      }
      const nameKeys: string[] = [];
      if (u.customName) nameKeys.push(normName(u.customName));
      if (u.ingredientId !== null) {
        const pub = publicById.get(u.ingredientId);
        if (pub) nameKeys.push(normName(pub.name));
      }
      for (const key of nameKeys) {
        if (key && !userByName.has(key)) userByName.set(key, u);
      }
    }

    let total = 0;
    let unknownCount = 0;
    const lines: CostLine[] = scaled.map((s) => {
      const name = this.resolveName(s, publicById);
      let userPrice = s.ingredientId !== null ? userByIngId.get(s.ingredientId) : undefined;
      if (!userPrice) {
        // 名称兜底：行名 = customName，缺省回退行 ingredientId 的公共名（方向③）。
        // 注意不能用 resolveName 的 'Unknown ingredient' 兜底值当键。
        const lineName =
          s.customName ??
          (s.ingredientId !== null ? publicById.get(s.ingredientId)?.name : undefined);
        if (lineName) userPrice = userByName.get(normName(lineName));
      }

      if (userPrice) {
        const unitPrice = parseFloat(userPrice.unitPrice);
        const cost = this.computeCost(s.scaledAmount, s.unit, unitPrice, userPrice.priceUnit);
        if (cost !== null) {
          total += cost;
          return {
            ingredientId: s.ingredientId,
            name,
            amount: s.scaledAmount,
            unit: s.unit,
            unitPrice,
            priceUnit: userPrice.priceUnit,
            totalCost: round2(cost),
            source: 'user_lib',
          };
        }
      }

      // 公共库 referencePrice 是 CNY 计价的种子数据——非 CNY 部署跳过兜底，
      // 否则 ¥20/斤 会被冒充成 $20/斤 输出（该行降级 unknown）
      const pub =
        currency === 'CNY' && s.ingredientId !== null ? publicById.get(s.ingredientId) : undefined;
      if (pub && pub.referencePrice && pub.referenceUnit) {
        const unitPrice = parseFloat(pub.referencePrice);
        const cost = this.computeCost(s.scaledAmount, s.unit, unitPrice, pub.referenceUnit);
        if (cost !== null) {
          total += cost;
          return {
            ingredientId: s.ingredientId,
            name,
            amount: s.scaledAmount,
            unit: s.unit,
            unitPrice,
            priceUnit: pub.referenceUnit,
            totalCost: round2(cost),
            source: 'public_lib',
          };
        }
      }

      unknownCount++;
      return {
        ingredientId: s.ingredientId,
        name,
        amount: s.scaledAmount,
        unit: s.unit,
        unitPrice: null,
        priceUnit: null,
        totalCost: 0,
        source: 'unknown',
      };
    });

    return {
      currency,
      totalCost: round2(total),
      lines,
      unknownCount,
    };
  }

  private computeCost(
    amount: number,
    unit: string,
    unitPrice: number,
    priceUnit: string,
  ): number | null {
    if (unit === priceUnit) return amount * unitPrice;
    const converted = convert(amount, unit, priceUnit);
    if (converted === null) return null;
    return converted * unitPrice;
  }

  private resolveName(s: CostableItem, publicById: Map<number, Ingredient>): string {
    if (s.customName) return s.customName;
    if (s.ingredientId !== null) {
      const pub = publicById.get(s.ingredientId);
      if (pub) return pub.name;
    }
    return 'Unknown ingredient';
  }
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

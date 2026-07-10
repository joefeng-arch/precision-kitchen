import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { convert } from '../../common/utils/unit-converter';
import { Ingredient } from '../ingredients/entities/ingredient.entity';
import { UserIngredient } from '../ingredients/entities/user-ingredient.entity';
import { CostSource } from './entities/cooking-log-cost.entity';

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
    const ingredientIds = scaled.map((s) => s.ingredientId).filter((v): v is number => v !== null);

    const [userLib, publicLib] = await Promise.all([
      ingredientIds.length
        ? this.userIngs.find({ where: { userId, ingredientId: In(ingredientIds) } })
        : Promise.resolve([] as UserIngredient[]),
      ingredientIds.length
        ? this.publicIngs.find({ where: { id: In(ingredientIds) } })
        : Promise.resolve([] as Ingredient[]),
    ]);

    const userByIngId = new Map<number, UserIngredient>();
    for (const u of userLib) {
      if (u.ingredientId !== null) userByIngId.set(u.ingredientId, u);
    }
    const publicById = new Map<number, Ingredient>(publicLib.map((p) => [p.id, p]));

    let total = 0;
    let unknownCount = 0;
    const lines: CostLine[] = scaled.map((s) => {
      const name = this.resolveName(s, publicById);
      const userPrice = s.ingredientId !== null ? userByIngId.get(s.ingredientId) : undefined;

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
    return '未知食材';
  }
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

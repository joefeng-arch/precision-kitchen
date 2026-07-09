import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { paginate } from '../../common/dto/pagination.dto';
import { ScalingService } from '../recipes/scaling.service';
import { User } from '../users/entities/user.entity';
import { CostCalculatorService } from './cost-calculator.service';
import { StockDeductionService, DeductionResult } from './stock-deduction.service';
import { CreateCookingLogDto, ListCookingLogsDto, PreviewCostDto } from './dto/cooking.dto';
import { CookingLogCost } from './entities/cooking-log-cost.entity';
import { CookingLog } from './entities/cooking-log.entity';

@Injectable()
export class CookingService {
  constructor(
    @InjectRepository(CookingLog) private readonly logs: Repository<CookingLog>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly scaling: ScalingService,
    private readonly costCalc: CostCalculatorService,
    private readonly deduction: StockDeductionService,
    private readonly ds: DataSource,
  ) {}

  async previewCost(userId: string, dto: PreviewCostDto) {
    const scaled = await this.scaling.scale(dto.recipeId, dto.servings);
    const cost = await this.costCalc.calculate(userId, scaled.ingredients);
    return { scaled, cost };
  }

  async createLog(userId: string, dto: CreateCookingLogDto) {
    const scaled = await this.scaling.scale(dto.recipeId, dto.servings);
    const cost = await this.costCalc.calculate(userId, scaled.ingredients);

    const savedLog = await this.ds.transaction(async (mgr) => {
      const log = mgr.create(CookingLog, {
        userId,
        recipeId: dto.recipeId,
        recipeTitle: scaled.title,
        servings: dto.servings.toFixed(2),
        durationMinutes: dto.durationMinutes ?? null,
        rating: dto.rating ?? null,
        notes: dto.notes ?? null,
        totalCost: cost.totalCost.toFixed(2),
        currency: cost.currency,
        cookedAt: dto.cookedAt ? new Date(dto.cookedAt) : new Date(),
      });
      const saved = await mgr.save(log);

      const costEntities = cost.lines.map((l) =>
        mgr.create(CookingLogCost, {
          logId: saved.id,
          ingredientId: l.ingredientId,
          name: l.name,
          amount: l.amount.toFixed(2),
          unit: l.unit,
          unitPrice: l.unitPrice !== null ? l.unitPrice.toFixed(4) : null,
          priceUnit: l.priceUnit,
          totalCost: l.totalCost.toFixed(2),
          source: l.source,
        }),
      );
      await mgr.save(costEntities);

      return this.findOneInTx(mgr, userId, saved.id);
    });

    // 如果用户开了"自动扣库存"，落库成功后尝试扣减；扣减失败不应影响 log 已保存
    let deduction: DeductionResult | null = null;
    const user = await this.users.findOne({ where: { id: userId } });
    if (user?.autoDeductStock) {
      try {
        deduction = await this.deduction.deduct(userId, savedLog.id, dto.recipeId, dto.servings);
      } catch (e) {
        // 不抛，给前端一个空回执

        console.error('[auto-deduct] failed', e);
      }
    }

    return { ...savedLog, deduction };
  }

  async list(userId: string, query: ListCookingLogsDto) {
    const { page = 1, pageSize = 20 } = query;
    const [items, total] = await this.logs.findAndCount({
      where: { userId },
      order: { cookedAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return paginate(items, total, page, pageSize);
  }

  async findOne(userId: string, id: string) {
    const log = await this.logs.findOne({ where: { id, userId }, relations: ['costs'] });
    if (!log) throw new NotFoundException('CookingLog not found');
    return log;
  }

  async remove(userId: string, id: string) {
    const log = await this.findOne(userId, id);
    await this.logs.remove(log);
    return { id };
  }

  private async findOneInTx(mgr: import('typeorm').EntityManager, userId: string, id: string) {
    const log = await mgr.findOne(CookingLog, {
      where: { id, userId },
      relations: ['costs'],
    });
    if (!log) throw new NotFoundException('CookingLog not found');
    return log;
  }
}

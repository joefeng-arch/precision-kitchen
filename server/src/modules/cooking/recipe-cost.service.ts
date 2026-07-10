import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Recipe } from '../recipes/entities/recipe.entity';
import { ScalingService } from '../recipes/scaling.service';
import type { UserRole } from '../users/entities/user.entity';
import { CostableItem, CostBreakdown, CostCalculatorService } from './cost-calculator.service';
import { RecipeCostDto } from './dto/recipe-cost.dto';

/**
 * POST /cooking/cost 的薄编排层：锁定式缩放（可选）→ 成本估算。
 * 与国内 previewCost（legacy 份数缩放）并存，互不触碰。
 */
@Injectable()
export class RecipeCostService {
  constructor(
    @InjectRepository(Recipe) private readonly recipes: Repository<Recipe>,
    private readonly scaling: ScalingService,
    private readonly costCalc: CostCalculatorService,
    private readonly config: ConfigService,
  ) {}

  async getCost(userId: string, tier: UserRole, dto: RecipeCostDto): Promise<CostBreakdown> {
    // PRD §5.2 FREE 不含成本；env 开关便于翻转决策。403 而非 401（客户端 401 强制登出）
    const proOnly = this.config.get<string>('COST_PRO_ONLY', 'false') === 'true';
    if (proOnly && tier !== 'vip') {
      throw new ForbiddenException('Cost insights are a PRO feature — upgrade to unlock');
    }

    const items = dto.scale
      ? (await this.scaling.scaleWithSpec(dto.recipeId, dto.scale.toScaleSpec())).ingredients
      : await this.originalAmounts(dto.recipeId);

    return this.costCalc.calculate(userId, items);
  }

  /** 无缩放：按配方原始用量（与 toEngineIngredients 相同的 (sort,id) 序） */
  private async originalAmounts(recipeId: string): Promise<CostableItem[]> {
    const recipe = await this.recipes.findOne({
      where: { id: recipeId },
      relations: ['ingredients'],
    });
    if (!recipe) throw new NotFoundException('Recipe not found');

    return [...recipe.ingredients]
      .sort((a, b) => a.sort - b.sort || a.id - b.id)
      .map((ri) => ({
        ingredientId: ri.ingredientId,
        customName: ri.customName,
        scaledAmount: parseFloat(ri.amount),
        unit: ri.unit,
      }));
  }
}

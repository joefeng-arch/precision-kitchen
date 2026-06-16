import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { MealPlan } from './entities/meal-plan.entity';
import { Recipe } from '../recipes/entities/recipe.entity';
import {
  ShoppingListResult,
  ShoppingListService,
} from '../shopping-list/shopping-list.service';

@Injectable()
export class MealPlansService {
  private readonly logger = new Logger(MealPlansService.name);

  constructor(
    @InjectRepository(MealPlan)
    private readonly mealPlanRepo: Repository<MealPlan>,
    @InjectRepository(Recipe)
    private readonly recipeRepo: Repository<Recipe>,
    private readonly shoppingListService: ShoppingListService,
  ) {}

  // ─── Create ────────────────────────────────────────────────
  async create(
    userId: string,
    dto: {
      planDate: string;
      mealType: string;
      recipeId: string;
      servings?: number;
    },
  ): Promise<MealPlan> {
    // Verify recipe exists
    const recipe = await this.recipeRepo.findOneBy({ id: dto.recipeId });
    if (!recipe) {
      throw new NotFoundException('菜谱不存在');
    }

    // Check for duplicate
    const existing = await this.mealPlanRepo.findOneBy({
      userId,
      planDate: dto.planDate,
      mealType: dto.mealType as any,
      recipeId: dto.recipeId,
    });
    if (existing) {
      throw new ConflictException('该餐次已添加过此菜谱');
    }

    const mealPlan = this.mealPlanRepo.create({
      userId,
      planDate: dto.planDate,
      mealType: dto.mealType as any,
      recipeId: dto.recipeId,
      servings: String(dto.servings ?? recipe.baseServings),
    });

    return this.mealPlanRepo.save(mealPlan);
  }

  // ─── Query by date range ───────────────────────────────────
  async findByDateRange(
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<MealPlan[]> {
    return this.mealPlanRepo.find({
      where: {
        userId,
        planDate: Between(startDate, endDate),
      },
      relations: ['recipe'],
      order: { planDate: 'ASC', mealType: 'ASC' },
    });
  }

  // ─── Delete ────────────────────────────────────────────────
  async remove(userId: string, id: string): Promise<{ id: string }> {
    const plan = await this.mealPlanRepo.findOneBy({ id, userId });
    if (!plan) {
      throw new NotFoundException('餐单项不存在');
    }
    await this.mealPlanRepo.remove(plan);
    return { id };
  }

  // ─── Convert week plan → shopping list ─────────────────────
  async toShoppingList(
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<ShoppingListResult> {
    const plans = await this.mealPlanRepo.find({
      where: {
        userId,
        planDate: Between(startDate, endDate),
      },
    });

    if (plans.length === 0) {
      return { groups: [], totalCost: null, sourceRecipes: [] };
    }

    // Aggregate: same recipeId → sum servings
    const recipeServings = new Map<string, number>();
    for (const plan of plans) {
      const servings = parseFloat(plan.servings) || 1;
      recipeServings.set(
        plan.recipeId,
        (recipeServings.get(plan.recipeId) ?? 0) + servings,
      );
    }

    const items = [...recipeServings.entries()].map(([recipeId, servings]) => ({
      recipeId,
      servings: Math.round(servings * 100) / 100,
    }));

    return this.shoppingListService.generate(userId, items);
  }
}

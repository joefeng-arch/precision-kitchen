import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MealPlan } from './entities/meal-plan.entity';
import { Recipe } from '../recipes/entities/recipe.entity';
import { ShoppingListModule } from '../shopping-list/shopping-list.module';
import { MealPlansController } from './meal-plans.controller';
import { MealPlansService } from './meal-plans.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([MealPlan, Recipe]),
    ShoppingListModule, // reuse ShoppingListService.generate()
  ],
  controllers: [MealPlansController],
  providers: [MealPlansService],
  exports: [MealPlansService],
})
export class MealPlansModule {}

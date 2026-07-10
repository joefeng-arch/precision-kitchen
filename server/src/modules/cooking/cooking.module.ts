import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ingredient } from '../ingredients/entities/ingredient.entity';
import { UserIngredient } from '../ingredients/entities/user-ingredient.entity';
import { Recipe } from '../recipes/entities/recipe.entity';
import { RecipesModule } from '../recipes/recipes.module';
import { User } from '../users/entities/user.entity';
import { CookingController } from './cooking.controller';
import { CookingService } from './cooking.service';
import { CostCalculatorService } from './cost-calculator.service';
import { RecipeCostService } from './recipe-cost.service';
import { StockDeductionService } from './stock-deduction.service';
import { CookingLogCost } from './entities/cooking-log-cost.entity';
import { CookingLog } from './entities/cooking-log.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CookingLog,
      CookingLogCost,
      UserIngredient,
      Ingredient,
      User,
      Recipe,
    ]),
    RecipesModule,
  ],
  controllers: [CookingController],
  providers: [CookingService, CostCalculatorService, RecipeCostService, StockDeductionService],
  exports: [CookingService, StockDeductionService],
})
export class CookingModule {}

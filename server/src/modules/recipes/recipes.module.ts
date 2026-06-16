import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from '../categories/entities/category.entity';
import { Ingredient } from '../ingredients/entities/ingredient.entity';
import { User } from '../users/entities/user.entity';
import { RecipeCategory } from './entities/recipe-category.entity';
import { RecipeIngredient } from './entities/recipe-ingredient.entity';
import { RecipeStep } from './entities/recipe-step.entity';
import { RecipeVersion } from './entities/recipe-version.entity';
import { Recipe } from './entities/recipe.entity';
import { RecipeParseService } from './recipe-parse.service';
import { RecipesController } from './recipes.controller';
import { RecipesService } from './recipes.service';
import { ScalingService } from './scaling.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Recipe,
      RecipeIngredient,
      RecipeStep,
      RecipeVersion,
      RecipeCategory,
      Category,
      Ingredient,
      User,
    ]),
  ],
  controllers: [RecipesController],
  providers: [RecipesService, ScalingService, RecipeParseService],
  exports: [RecipesService, ScalingService],
})
export class RecipesModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from '../categories/entities/category.entity';
import { Ingredient } from './entities/ingredient.entity';
import { UserIngredient } from './entities/user-ingredient.entity';
import { IngredientsController } from './ingredients.controller';
import { IngredientsService } from './ingredients.service';
import { UserIngredientsController } from './user-ingredients.controller';
import { UserIngredientsService } from './user-ingredients.service';

@Module({
  imports: [TypeOrmModule.forFeature([Ingredient, UserIngredient, Category])],
  controllers: [IngredientsController, UserIngredientsController],
  providers: [IngredientsService, UserIngredientsService],
  exports: [IngredientsService, UserIngredientsService],
})
export class IngredientsModule {}

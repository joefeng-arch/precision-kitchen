import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  calculateScaledAmount,
  roundAmount,
} from '../../common/utils/scaling-calculator';
import { Recipe } from './entities/recipe.entity';

export interface ScaledIngredientItem {
  id: number;
  ingredientId: number | null;
  customName: string | null;
  groupName: string | null;
  unit: string;
  originalAmount: number;
  scaledAmount: number;
  scaleType: 'linear' | 'sub_linear' | 'fixed';
  scaleFactor: number;
  notes: string | null;
  sort: number;
}

export interface ScaleResult {
  recipeId: string;
  title: string;
  baseServings: number;
  targetServings: number;
  multiplier: number;
  ingredients: ScaledIngredientItem[];
}

@Injectable()
export class ScalingService {
  constructor(
    @InjectRepository(Recipe) private readonly recipes: Repository<Recipe>,
  ) {}

  async scale(recipeId: string, targetServings: number): Promise<ScaleResult> {
    if (targetServings <= 0) {
      throw new BadRequestException('targetServings 必须 > 0');
    }
    const recipe = await this.recipes.findOne({
      where: { id: recipeId },
      relations: ['ingredients'],
    });
    if (!recipe) throw new NotFoundException('Recipe not found');

    const multiplier = targetServings / recipe.baseServings;
    const ingredients = recipe.ingredients
      .slice()
      .sort((a, b) => a.sort - b.sort || a.id - b.id)
      .map<ScaledIngredientItem>((ri) => {
        const original = parseFloat(ri.amount);
        const factor = parseFloat(ri.scaleFactor);
        const scaled = calculateScaledAmount(original, multiplier, ri.scaleType, factor);
        return {
          id: ri.id,
          ingredientId: ri.ingredientId,
          customName: ri.customName,
          groupName: ri.groupName,
          unit: ri.unit,
          originalAmount: original,
          scaledAmount: roundAmount(scaled),
          scaleType: ri.scaleType,
          scaleFactor: factor,
          notes: ri.notes,
          sort: ri.sort,
        };
      });

    return {
      recipeId: recipe.id,
      title: recipe.title,
      baseServings: recipe.baseServings,
      targetServings,
      multiplier: Math.round(multiplier * 1000) / 1000,
      ingredients,
    };
  }
}

import { IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum MealTypeEnum {
  breakfast = 'breakfast',
  lunch = 'lunch',
  dinner = 'dinner',
  snack = 'snack',
}

export class CreateMealPlanDto {
  @ApiProperty({ example: '2026-06-02' })
  @IsDateString()
  planDate!: string;

  @ApiProperty({ enum: MealTypeEnum, example: 'lunch' })
  @IsEnum(MealTypeEnum)
  mealType!: MealTypeEnum;

  @ApiProperty({ example: 'uuid-of-recipe' })
  @IsUUID('4')
  recipeId!: string;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsNumber()
  @Min(0.5)
  servings?: number;
}

export class QueryMealPlansDto {
  @ApiProperty({ example: '2026-06-02' })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ example: '2026-06-08' })
  @IsDateString()
  endDate!: string;
}

export class MealPlanToShoppingListDto {
  @ApiProperty({ example: '2026-06-02' })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ example: '2026-06-08' })
  @IsDateString()
  endDate!: string;
}

import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { Difficulty, RecipeStatus } from '../entities/recipe.entity';
import { ScaleType } from '../entities/recipe-ingredient.entity';

const SCALE_TYPES = ['linear', 'sub_linear', 'fixed'] as const;
const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
const STATUSES = ['draft', 'published', 'archived'] as const;

export class RecipeIngredientDto {
  @ApiPropertyOptional()
  @ValidateIf((o) => !o.customName)
  @IsInt()
  ingredientId?: number;

  @ApiPropertyOptional()
  @ValidateIf((o) => !o.ingredientId)
  @IsString()
  @MaxLength(64)
  customName?: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount!: number;

  @ApiProperty()
  @IsString()
  @MaxLength(16)
  unit!: string;

  @ApiPropertyOptional({ enum: SCALE_TYPES, default: 'linear' })
  @IsOptional()
  @IsEnum(SCALE_TYPES)
  scaleType?: ScaleType;

  @ApiPropertyOptional({ default: 0.7 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  scaleFactor?: number;

  @ApiPropertyOptional({ description: '分组：主料/腌料/调味料 等' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  groupName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(128)
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  sort?: number;
}

export class RecipeStepDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  stepNumber!: number;

  @ApiProperty()
  @IsString()
  description!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(512)
  imageUrl?: string;

  @ApiPropertyOptional({ description: '此步计时秒数' })
  @IsOptional()
  @IsInt()
  @Min(0)
  durationSeconds?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(256)
  tips?: string;
}

export class CreateRecipeDto {
  @ApiProperty()
  @IsString()
  @MaxLength(128)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(512)
  coverImage?: string;

  @ApiPropertyOptional({ description: '主分类 id（保留向后兼容；推荐用 categoryIds）' })
  @IsOptional()
  @IsInt()
  categoryId?: number;

  @ApiPropertyOptional({ type: [Number], description: '多分类 id 列表（一个菜谱可归多类）' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsInt({ each: true })
  categoryIds?: number[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  mealSceneId?: number;

  @ApiPropertyOptional({ default: 2 })
  @IsOptional()
  @IsInt()
  @Min(1)
  baseServings?: number;

  @ApiPropertyOptional({ enum: DIFFICULTIES, default: 'medium' })
  @IsOptional()
  @IsEnum(DIFFICULTIES)
  difficulty?: Difficulty;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  totalMinutes?: number;

  @ApiPropertyOptional({ enum: STATUSES, default: 'draft' })
  @IsOptional()
  @IsEnum(STATUSES)
  status?: RecipeStatus;

  @ApiPropertyOptional({ description: '是否公开到发现页（默认私有）', default: false })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  tags?: string[];

  @ApiProperty({ type: [RecipeIngredientDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecipeIngredientDto)
  ingredients!: RecipeIngredientDto[];

  @ApiProperty({ type: [RecipeStepDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecipeStepDto)
  steps!: RecipeStepDto[];
}

export class UpdateRecipeDto extends PartialType(CreateRecipeDto) {
  @ApiPropertyOptional({ description: '版本备注' })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  changeNote?: string;
}

export class ParseTextDto {
  @ApiProperty({ description: '用户粘贴的菜谱原文' })
  @IsString()
  @MinLength(20, { message: '内容太少，请粘贴完整的菜谱（至少20字）' })
  @MaxLength(5000, { message: '内容过长，请适当裁剪（不超过5000字）' })
  text!: string;
}

export class ListRecipesDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  categoryId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  mealSceneId?: number;

  @ApiPropertyOptional({ enum: STATUSES })
  @IsOptional()
  @IsEnum(STATUSES)
  status?: RecipeStatus;

  @ApiPropertyOptional({ description: '只看自己的菜谱' })
  @IsOptional()
  @IsString()
  authorId?: string;

  @ApiPropertyOptional({ description: '只看公开 / 私有菜谱' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isPublic?: boolean;

  @ApiPropertyOptional({ description: '只看官方推荐（老舅推荐）' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isFeatured?: boolean;
}

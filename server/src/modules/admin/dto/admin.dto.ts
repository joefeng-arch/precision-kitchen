import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { RecipeStatus } from '../../recipes/entities/recipe.entity';
import { UserRole, UserStatus } from '../../users/entities/user.entity';
import { CategoryType } from '../../categories/entities/category.entity';

/* ───────────────────── Constants ───────────────────── */

const ROLES = ['user', 'vip'] as const;
const USER_STATUSES = ['active', 'banned'] as const;
const RECIPE_STATUSES = ['draft', 'published', 'archived'] as const;
const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
const SCALE_TYPES = ['linear', 'sub_linear', 'fixed'] as const;
const CATEGORY_TYPES = ['recipe', 'ingredient', 'meal_scene'] as const;

/* ───────────────────── Recipe DTOs ───────────────────── */

export class AdminListRecipesDto extends PaginationDto {
  @ApiPropertyOptional({ enum: RECIPE_STATUSES })
  @IsOptional()
  @IsEnum(RECIPE_STATUSES)
  status?: RecipeStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  authorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  categoryId?: number;

  @ApiPropertyOptional({ description: 'true / false as string' })
  @IsOptional()
  @IsString()
  isFeatured?: string;

  @ApiPropertyOptional({ description: 'ISO date string' })
  @IsOptional()
  @IsString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'ISO date string' })
  @IsOptional()
  @IsString()
  dateTo?: string;
}

export class SetRecipeStatusDto {
  @ApiProperty({ enum: RECIPE_STATUSES })
  @IsEnum(RECIPE_STATUSES)
  status!: RecipeStatus;
}

export class SetFeaturedDto {
  @ApiProperty()
  isFeatured!: boolean;
}

/* --- Ingredient sub-DTO for recipe creation --- */

export class RecipeIngredientItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  ingredientId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customName?: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  amount!: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  unit!: string;

  @ApiPropertyOptional({ enum: SCALE_TYPES, default: 'linear' })
  @IsOptional()
  @IsEnum(SCALE_TYPES)
  scaleType?: 'linear' | 'sub_linear' | 'fixed';

  @ApiPropertyOptional({ default: '0.70' })
  @IsOptional()
  @IsString()
  scaleFactor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  groupName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sort?: number;
}

/* --- Step sub-DTO for recipe creation --- */

export class RecipeStepItemDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  stepNumber!: number;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  description!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  durationSeconds?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tips?: string;
}

/* --- Create official recipe --- */

export class AdminCreateOfficialRecipeDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  coverImage?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  categoryId?: number;

  @ApiPropertyOptional({
    description: 'Multiple category IDs for recipe_categories junction',
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  categoryIds?: number[];

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  mealSceneId?: number;

  @ApiProperty({ default: 2 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  baseServings!: number;

  @ApiProperty({ enum: DIFFICULTIES, default: 'medium' })
  @IsEnum(DIFFICULTIES)
  difficulty!: 'easy' | 'medium' | 'hard';

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  totalMinutes?: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiProperty({ type: [RecipeIngredientItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecipeIngredientItemDto)
  ingredients!: RecipeIngredientItemDto[];

  @ApiProperty({ type: [RecipeStepItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecipeStepItemDto)
  steps!: RecipeStepItemDto[];
}

/* --- Update recipe (partial) --- */

export class AdminUpdateRecipeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  coverImage?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  categoryId?: number;

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  categoryIds?: number[];

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  mealSceneId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  baseServings?: number;

  @ApiPropertyOptional({ enum: DIFFICULTIES })
  @IsOptional()
  @IsEnum(DIFFICULTIES)
  difficulty?: 'easy' | 'medium' | 'hard';

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  totalMinutes?: number;

  @ApiPropertyOptional({ enum: RECIPE_STATUSES })
  @IsOptional()
  @IsEnum(RECIPE_STATUSES)
  status?: RecipeStatus;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  isPublic?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  isFeatured?: boolean;

  @ApiPropertyOptional({ type: [RecipeIngredientItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecipeIngredientItemDto)
  ingredients?: RecipeIngredientItemDto[];

  @ApiPropertyOptional({ type: [RecipeStepItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecipeStepItemDto)
  steps?: RecipeStepItemDto[];
}

/* --- Batch IDs --- */

export class BatchIdsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  ids!: string[];
}

/* ───────────────────── User DTOs ───────────────────── */

export class AdminListUsersDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ROLES })
  @IsOptional()
  @IsEnum(ROLES)
  role?: UserRole;

  @ApiPropertyOptional({ enum: USER_STATUSES })
  @IsOptional()
  @IsEnum(USER_STATUSES)
  status?: UserStatus;

  @ApiPropertyOptional({ description: 'ISO date string' })
  @IsOptional()
  @IsString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'ISO date string' })
  @IsOptional()
  @IsString()
  dateTo?: string;
}

export class SetUserRoleDto {
  @ApiProperty({ enum: ROLES })
  @IsEnum(ROLES)
  role!: UserRole;
}

export class SetUserStatusDto {
  @ApiProperty({ enum: USER_STATUSES })
  @IsEnum(USER_STATUSES)
  status!: UserStatus;
}

export class SetVipDto {
  @ApiProperty({ description: 'ISO date string or null to remove VIP', nullable: true })
  vipExpiresAt!: string | null;
}

/* ───────────────────── Ingredient DTOs ───────────────────── */

export class AdminListIngredientsDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  categoryId?: number;
}

export class AdminCreateIngredientDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  categoryId?: number;

  @ApiPropertyOptional({ default: 'g' })
  @IsOptional()
  @IsString()
  defaultUnit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  referencePrice?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  referenceUnit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ enum: SCALE_TYPES, default: 'linear' })
  @IsOptional()
  @IsEnum(SCALE_TYPES)
  defaultScaleType?: 'linear' | 'sub_linear' | 'fixed';

  @ApiPropertyOptional({ type: [String], description: '别名列表' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  aliases?: string[];

  @ApiPropertyOptional({ description: '每100g热量(kcal)' })
  @IsOptional()
  @IsString()
  calories?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sort?: number;
}

export class AdminUpdateIngredientDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  categoryId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  defaultUnit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  referencePrice?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  referenceUnit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ enum: SCALE_TYPES })
  @IsOptional()
  @IsEnum(SCALE_TYPES)
  defaultScaleType?: 'linear' | 'sub_linear' | 'fixed';

  @ApiPropertyOptional({ type: [String], description: '别名列表' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  aliases?: string[];

  @ApiPropertyOptional({ description: '每100g热量(kcal)' })
  @IsOptional()
  @IsString()
  calories?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sort?: number;
}

/* ───────────────────── Category DTOs ───────────────────── */

export class AdminListCategoriesDto extends PaginationDto {
  @ApiPropertyOptional({ enum: CATEGORY_TYPES })
  @IsOptional()
  @IsEnum(CATEGORY_TYPES)
  type?: CategoryType;
}

export class AdminCreateCategoryDto {
  @ApiProperty({ enum: CATEGORY_TYPES })
  @IsEnum(CATEGORY_TYPES)
  type!: CategoryType;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sort?: number;
}

export class AdminUpdateCategoryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sort?: number;

  @ApiPropertyOptional({ description: '启用/禁用分类' })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class SetCategoryEnabledDto {
  @ApiProperty()
  @IsBoolean()
  enabled!: boolean;
}

/* --- Reorder sub-item --- */

export class ReorderItem {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  id!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sort!: number;
}

export class ReorderCategoriesDto {
  @ApiProperty({ type: [ReorderItem] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReorderItem)
  items!: ReorderItem[];
}

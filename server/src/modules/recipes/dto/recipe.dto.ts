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
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import type { ScalingProfile, ScalingRole } from '../../../common/utils/scaling-engine';
import { Difficulty, RecipeStatus } from '../entities/recipe.entity';
import { ScaleType } from '../entities/recipe-ingredient.entity';

const SCALE_TYPES = ['linear', 'sub_linear', 'fixed'] as const;
const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
const STATUSES = ['draft', 'published', 'archived'] as const;
const SCALING_PROFILES = [
  'linear_legacy',
  'bakers_percentage',
  'ratio_based',
  'multi_ratio',
] as const;
const SCALING_ROLES = ['anchor', 'percentage', 'ratio_linked', 'fixed'] as const;

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

  // --- 缩放引擎字段（新 profile 用；linear_legacy 下保存时被剥离）---

  @ApiPropertyOptional({ enum: SCALING_ROLES })
  @IsOptional()
  @IsEnum(SCALING_ROLES)
  scalingRole?: ScalingRole;

  @ApiPropertyOptional({ description: 'bakers：相对锚点 %；multi_ratio：相对 percentBase %' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  @Max(9999.999) // decimal(7,3)
  percentageValue?: number;

  @ApiPropertyOptional({ description: '比例组名（multi_ratio）' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  ratioGroup?: string;

  @ApiPropertyOptional({ description: '组内 parts（咖啡 1 : 水 15）' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  @Max(9999999.999) // decimal(10,3)
  ratioValue?: number;

  @ApiPropertyOptional({ description: '取整小数位（0/1/2）；缺省走引擎默认' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2)
  roundDp?: number;
}

/** percentBase：下标 XOR 组名（保存前无 DB id，用 ingredients 数组下标，服务端重映射） */
export class PercentBaseDto {
  @ApiPropertyOptional({ description: 'ingredients 数组下标（0 起），指向 ratio_linked 原料' })
  @ValidateIf((o) => o.group === undefined)
  @IsInt()
  @Min(0)
  ingredientIndex?: number;

  @ApiPropertyOptional({ description: '比例组名（以组内成员用量之和为基准）' })
  @ValidateIf((o) => o.ingredientIndex === undefined)
  @IsString()
  @MaxLength(32)
  group?: string;
}

export class BaseAnchorDto {
  @ApiPropertyOptional({ type: PercentBaseDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PercentBaseDto)
  percentBase?: PercentBaseDto;
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

  @ApiPropertyOptional({ enum: SCALING_PROFILES, default: 'linear_legacy' })
  @IsOptional()
  @IsEnum(SCALING_PROFILES)
  scalingProfile?: ScalingProfile;

  @ApiPropertyOptional({ type: BaseAnchorDto, description: 'multi_ratio 有 percentage 料时必给' })
  @IsOptional()
  @ValidateNested()
  @Type(() => BaseAnchorDto)
  baseAnchor?: BaseAnchorDto;

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

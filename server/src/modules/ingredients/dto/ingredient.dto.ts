import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

const SCALE_TYPES = ['linear', 'sub_linear', 'fixed'] as const;
export type ScaleType = (typeof SCALE_TYPES)[number];

export class CreateIngredientDto {
  @ApiProperty()
  @IsString()
  @MaxLength(64)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  categoryId?: number;

  @ApiPropertyOptional({ default: 'g' })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  defaultUnit?: string;

  @ApiPropertyOptional({ description: '参考单价' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  referencePrice?: number;

  @ApiPropertyOptional({ description: '参考单价对应单位，例如 元/斤 中的 斤' })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  referenceUnit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(512)
  imageUrl?: string;

  @ApiPropertyOptional({ enum: SCALE_TYPES, default: 'linear' })
  @IsOptional()
  @IsEnum(SCALE_TYPES)
  defaultScaleType?: ScaleType;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  sort?: number;
}

export class UpdateIngredientDto extends PartialType(CreateIngredientDto) {}

export class ListIngredientsDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  categoryId?: number;
}

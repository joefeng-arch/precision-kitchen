import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export const STORAGE_TYPES = ['room_temp', 'refrigerated', 'frozen'] as const;
export type StorageType = (typeof STORAGE_TYPES)[number];
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class CreateUserIngredientDto {
  @ApiPropertyOptional({ description: '关联公共食材 id（与 customName 二选一）' })
  @ValidateIf((o) => !o.customName)
  @IsInt()
  ingredientId?: number;

  @ApiPropertyOptional({ description: '自定义食材名（公共库没有时用）' })
  @ValidateIf((o) => !o.ingredientId)
  @IsString()
  @MaxLength(64)
  customName?: string;

  @ApiProperty({ description: '单价（canonical 单位下，最多 4 位小数）' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  unitPrice!: number;

  @ApiProperty({ description: '单价对应单位，如 g / 斤 / 个' })
  @IsString()
  @MaxLength(16)
  priceUnit!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  stockAmount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(16)
  stockUnit?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(256)
  notes?: string;

  @ApiPropertyOptional({ description: '保质期 / 过期日期 (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @ApiPropertyOptional({
    description: '储存方式',
    enum: STORAGE_TYPES,
  })
  @IsOptional()
  @IsIn(STORAGE_TYPES as unknown as string[])
  storageType?: StorageType;

  @ApiPropertyOptional({
    description: '食材分类 id（references categories where type=ingredient）',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  categoryId?: number;
}

export class UpdateUserIngredientDto extends PartialType(CreateUserIngredientDto) {}

export class ListUserIngredientsDto extends PaginationDto {
  @ApiPropertyOptional({ description: '按分类 id 筛选' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  categoryId?: number;
}

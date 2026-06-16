import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class PreviewCostDto {
  @ApiProperty()
  @IsUUID()
  recipeId!: string;

  @ApiProperty({ description: '目标份数' })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  servings!: number;
}

export class CreateCookingLogDto {
  @ApiProperty()
  @IsUUID()
  recipeId!: string;

  @ApiProperty({ description: '实际做的份数' })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  servings!: number;

  @ApiPropertyOptional({ description: '实际耗时（分钟）' })
  @IsOptional()
  @IsInt()
  @Min(0)
  durationMinutes?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(512)
  notes?: string;

  @ApiPropertyOptional({ description: '完成时间，缺省为 now' })
  @IsOptional()
  @IsString()
  cookedAt?: string;
}

export class ListCookingLogsDto extends PaginationDto {}

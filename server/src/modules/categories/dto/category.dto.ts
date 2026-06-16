import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { CategoryType } from '../entities/category.entity';

const TYPES = ['recipe', 'ingredient', 'meal_scene'] as const;

export class CreateCategoryDto {
  @ApiProperty({ enum: TYPES })
  @IsEnum(TYPES)
  type!: CategoryType;

  @ApiProperty()
  @IsString()
  @MaxLength(32)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  icon?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sort?: number;
}

export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}

export class ListCategoriesDto extends PaginationDto {
  @ApiPropertyOptional({ enum: TYPES })
  @IsOptional()
  @IsEnum(TYPES)
  type?: CategoryType;
}

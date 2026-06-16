import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, Min } from 'class-validator';

export class ScaleQueryDto {
  @ApiProperty({ description: '目标份数', example: 4 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  servings!: number;
}

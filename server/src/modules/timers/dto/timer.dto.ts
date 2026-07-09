import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class CreateTimerDto {
  @ApiProperty()
  @IsString()
  @MaxLength(64)
  label!: string;

  @ApiProperty({ description: '总秒数，最长 6 小时' })
  @IsInt()
  @Min(1)
  @Max(6 * 3600)
  durationSeconds!: number;

  @ApiPropertyOptional({ description: '关联菜谱 id（用于步骤计时回溯）' })
  @IsOptional()
  @IsUUID()
  recipeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  stepNumber?: number;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsObject, IsOptional, IsUUID, ValidateNested } from 'class-validator';
import { ScaleRequestDto } from '../../recipes/dto/scale.dto';

/**
 * POST /cooking/cost —— 按当前（或缩放后）用量估算配方成本。
 * scale 缺省 = 原始用量；形状与 POST /recipes/:id/scale 请求体一致（复用其判别校验）。
 */
export class RecipeCostDto {
  @ApiProperty({ description: '配方 id（uuid）' })
  @IsUUID()
  recipeId!: string;

  @ApiPropertyOptional({ type: ScaleRequestDto, description: '可选缩放（同 §3 判别体）' })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ScaleRequestDto)
  scale?: ScaleRequestDto;
}

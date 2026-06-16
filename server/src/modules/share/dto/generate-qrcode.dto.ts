import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class GenerateQrcodeDto {
  @ApiProperty({ description: '菜谱 ID', example: 'xxxxxxxx-xxxx-4xxx-xxxx-xxxxxxxxxxxx' })
  @IsUUID('4')
  recipeId!: string;
}

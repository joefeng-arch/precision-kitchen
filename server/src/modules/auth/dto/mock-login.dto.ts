import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/**
 * Mock 登录请求体（仅 dev）
 * code 作为用户种子：同一 code → 同一用户。不传则默认 "dev"。
 */
export class MockLoginDto {
  @ApiPropertyOptional({ description: '用户种子，同值映射同一用户', default: 'dev' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ description: '昵称（可选）' })
  @IsOptional()
  @IsString()
  nickname?: string;

  @ApiPropertyOptional({ description: '头像 URL（可选）' })
  @IsOptional()
  @IsString()
  avatar?: string;
}

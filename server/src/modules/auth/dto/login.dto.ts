import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * 通用登录请求体 — provider 无关。
 * 由 auth.service.login(provider, credentials) 路由到对应 AuthProvider。
 */
export class LoginDto {
  @ApiProperty({ description: "登录方式：'wechat' | 'apple' | 'google' | 'mock' ..." })
  @IsString()
  @MinLength(1)
  @MaxLength(16)
  provider!: string;

  @ApiProperty({ description: '第三方授权码 / token（如 OAuth code、Apple identityToken）' })
  @IsString()
  @MinLength(1)
  @MaxLength(512)
  code!: string;

  @ApiPropertyOptional({ description: '用户昵称（首次登录或更新时用）' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  nickname?: string;

  @ApiPropertyOptional({ description: '头像 URL' })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  avatar?: string;
}

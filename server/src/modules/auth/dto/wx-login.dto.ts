import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class WxLoginDto {
  @ApiProperty({ description: '微信小程序 wx.login() 返回的 code；dev 环境可传 mock-xxx' })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
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

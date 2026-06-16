import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class AdminLoginDto {
  @ApiProperty({ example: 'laojiu_admin' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  username!: string;

  @ApiProperty({ example: '********' })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(128)
  password!: string;
}

export class AdminChangePasswordDto {
  @ApiProperty({ description: '当前密码' })
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  @ApiProperty({ description: '新密码（至少 8 位）' })
  @IsString()
  @MinLength(8, { message: '新密码不能少于 8 位' })
  @MaxLength(128)
  newPassword!: string;
}

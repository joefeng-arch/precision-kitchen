import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser, JwtUserPayload } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UsersService } from './users.service';

class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  nickname?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  avatar?: string | null;

  @IsOptional()
  @IsBoolean()
  autoDeductStock?: boolean;
}

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: '获取当前登录用户' })
  me(@CurrentUser() user: JwtUserPayload) {
    return this.users.findByIdOrFail(user.sub);
  }

  @Patch('me')
  @ApiOperation({ summary: '更新当前用户资料' })
  updateMe(@CurrentUser() user: JwtUserPayload, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(user.sub, dto);
  }
}

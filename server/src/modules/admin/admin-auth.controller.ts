import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AdminAuthService, AdminJwtPayload } from './admin-auth.service';
import { AdminChangePasswordDto, AdminLoginDto } from './dto/admin-auth.dto';
import { AdminJwtAuthGuard } from './guards/admin-jwt-auth.guard';
import { CurrentAdmin } from './decorators/current-admin.decorator';

@ApiTags('admin-auth')
@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly authService: AdminAuthService) {}

  @Post('login')
  @ApiOperation({ summary: '管理后台登录（用户名+密码）' })
  login(@Body() dto: AdminLoginDto) {
    return this.authService.login(dto.username, dto.password);
  }

  @Post('change-password')
  @ApiBearerAuth()
  @UseGuards(AdminJwtAuthGuard)
  @ApiOperation({ summary: '修改管理员密码（首次登录强制执行）' })
  changePassword(@CurrentAdmin() admin: AdminJwtPayload, @Body() dto: AdminChangePasswordDto) {
    return this.authService.changePassword(admin.sub, dto.currentPassword, dto.newPassword);
  }

  @Get('whoami')
  @ApiBearerAuth()
  @UseGuards(AdminJwtAuthGuard)
  @ApiOperation({ summary: '当前管理员信息' })
  whoami(@CurrentAdmin() admin: AdminJwtPayload) {
    return admin;
  }
}

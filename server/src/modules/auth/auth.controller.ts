import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtUserPayload } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthService } from './auth.service';
import { WxLoginDto } from './dto/wx-login.dto';
import { MockLoginDto } from './dto/mock-login.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('wx-login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '微信小程序登录（dev 环境支持 mock-xxx code）' })
  wxLogin(@Body() dto: WxLoginDto) {
    return this.auth.wxLogin(dto.code, { nickname: dto.nickname, avatar: dto.avatar });
  }

  @Post('mock-login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '本地 Mock 登录（受 ALLOW_MOCK_LOGIN 控制，生产禁用）' })
  mockLogin(@Body() dto: MockLoginDto) {
    return this.auth.login('mock', {
      code: dto.code ?? 'dev',
      profile: { nickname: dto.nickname, avatar: dto.avatar },
    });
  }

  @Get('whoami')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '调试：返回当前 JWT payload' })
  whoami(@CurrentUser() user: JwtUserPayload) {
    return user;
  }
}

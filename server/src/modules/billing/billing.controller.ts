import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CurrentUser,
  JwtUserPayload,
} from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BillingService } from './billing.service';
import { RevenueCatWebhookGuard } from './revenuecat-webhook.guard';

@ApiTags('billing')
@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '订阅状态 + 配额用量（Me 页 / Paywall 单一状态面）' })
  status(@CurrentUser() user: JwtUserPayload) {
    return this.billing.getStatus(user.sub, user.role);
  }

  /**
   * RevenueCat 服务端 webhook（server-to-server）。
   * 不走 JWT：RevenueCatWebhookGuard 校验 Authorization 头全等密钥。
   * 不写 DTO：全局 ValidationPipe forbidNonWhitelisted 会 400 掉 RC 演进中的信封，
   * body 按 unknown 进 service 防御性解析。恒 200（RC 对非 2xx 重试数天）。
   */
  @Post('revenuecat/webhook')
  @UseGuards(RevenueCatWebhookGuard)
  @HttpCode(200)
  @ApiOperation({ summary: 'RevenueCat webhook（server-to-server，密钥头鉴权）' })
  revenueCatWebhook(@Body() body: unknown) {
    return this.billing.handleRevenueCatEvent(body);
  }

  @Post('mock-upgrade')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(200)
  @ApiOperation({ summary: 'dev 专用：mock 升级 PRO 30 天（受 ALLOW_MOCK_LOGIN 控制）' })
  mockUpgrade(@CurrentUser() user: JwtUserPayload) {
    return this.billing.mockUpgrade(user.sub);
  }

  @Post('mock-downgrade')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(200)
  @ApiOperation({ summary: 'dev 专用：mock 降级回 FREE（受 ALLOW_MOCK_LOGIN 控制）' })
  mockDowngrade(@CurrentUser() user: JwtUserPayload) {
    return this.billing.mockDowngrade(user.sub);
  }
}

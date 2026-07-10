import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * RevenueCat webhook 鉴权：Authorization 头必须与 REVENUECAT_WEBHOOK_SECRET 全等
 * （值 = RC 后台 webhook 配置里填写的 Authorization 头原文）。
 * 未配置密钥时 fail closed —— 任何请求 401。
 */
@Injectable()
export class RevenueCatWebhookGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const secret = this.config.get<string>('REVENUECAT_WEBHOOK_SECRET');
    if (!secret) {
      throw new UnauthorizedException('RevenueCat webhook 未配置密钥');
    }
    const req = context.switchToHttp().getRequest<{ headers: Record<string, string> }>();
    if (req.headers.authorization !== secret) {
      throw new UnauthorizedException('Invalid webhook authorization');
    }
    return true;
  }
}

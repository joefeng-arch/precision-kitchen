import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RevenueCatWebhookGuard } from './revenuecat-webhook.guard';

function fakeConfig(values: Record<string, string> = {}): ConfigService {
  return {
    get: (key: string, def?: string) => values[key] ?? def,
  } as unknown as ConfigService;
}

function contextWithAuth(authorization?: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers: authorization ? { authorization } : {} }),
    }),
  } as unknown as ExecutionContext;
}

describe('RevenueCatWebhookGuard — Authorization 头全等校验', () => {
  it('REVENUECAT_WEBHOOK_SECRET 未配置 → 401（fail closed，不放任何请求）', () => {
    const guard = new RevenueCatWebhookGuard(fakeConfig({}));
    expect(() => guard.canActivate(contextWithAuth('anything'))).toThrow(UnauthorizedException);
  });

  it('缺 Authorization 头 → 401', () => {
    const guard = new RevenueCatWebhookGuard(fakeConfig({ REVENUECAT_WEBHOOK_SECRET: 's3cret' }));
    expect(() => guard.canActivate(contextWithAuth(undefined))).toThrow(UnauthorizedException);
  });

  it('头不匹配 → 401', () => {
    const guard = new RevenueCatWebhookGuard(fakeConfig({ REVENUECAT_WEBHOOK_SECRET: 's3cret' }));
    expect(() => guard.canActivate(contextWithAuth('wrong'))).toThrow(UnauthorizedException);
  });

  it('头与密钥全等 → 放行', () => {
    const guard = new RevenueCatWebhookGuard(fakeConfig({ REVENUECAT_WEBHOOK_SECRET: 's3cret' }));
    expect(guard.canActivate(contextWithAuth('s3cret'))).toBe(true);
  });
});

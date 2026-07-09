import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AuthProvider,
  AuthCredentials,
  AuthResult,
} from '../../../common/interfaces/auth-provider.interface';

/**
 * Mock 登录 Provider（仅供本地 / dev 使用）
 *
 * 独立于任何第三方登录（不依赖微信 / OAuth）。海外版 OAuth 短期接不通时，
 * 用它在本地拿到一个真实 JWT 完成开发联调。
 *
 * 安全：受 ALLOW_MOCK_LOGIN 控制——dev 默认开启，生产默认关闭。
 * 即使本 provider 被注册，只要 ALLOW_MOCK_LOGIN !== 'true' 就会拒绝认证。
 *
 * 用法：POST /auth/mock-login { "code": "alice" } → 返回 JWT。
 * 同一个 code 始终映射到同一个用户（externalId = mock-<code>），方便重复登录。
 */
@Injectable()
export class MockAuthProvider implements AuthProvider {
  readonly providerType = 'mock';
  private readonly logger = new Logger(MockAuthProvider.name);

  constructor(private readonly config: ConfigService) {}

  async authenticate(credentials: AuthCredentials): Promise<AuthResult> {
    const env = this.config.get<string>('NODE_ENV', 'development');
    const allowMock =
      this.config.get<string>('ALLOW_MOCK_LOGIN', env === 'production' ? 'false' : 'true') ===
      'true';

    if (!allowMock) {
      throw new UnauthorizedException('Mock 登录已禁用（ALLOW_MOCK_LOGIN!=true）');
    }

    const seed = (credentials.code || 'dev').trim() || 'dev';
    const externalId = `mock-${seed}`;
    this.logger.warn(`[mock login] externalId=${externalId}`);

    return {
      externalId,
      unionId: null,
      profile: {
        nickname: credentials.profile?.nickname ?? `Dev User ${seed}`,
        avatar: credentials.profile?.avatar ?? null,
      },
    };
  }
}

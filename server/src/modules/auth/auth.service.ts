import { Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JwtUserPayload } from '../../common/decorators/current-user.decorator';
import {
  AUTH_PROVIDERS,
  AuthProvider,
  AuthCredentials,
} from '../../common/interfaces/auth-provider.interface';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';

/**
 * AuthService — 登录入口
 *
 * 不直接实现任何平台的认证逻辑，而是委托给 AuthProvider 实现。
 * 职责：
 *  1. 根据 providerType 路由到对应 AuthProvider
 *  2. 用 AuthResult 创建/更新用户
 *  3. 签发 JWT
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly providerMap: Map<string, AuthProvider>;

  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    @Inject(AUTH_PROVIDERS) providers: AuthProvider[],
  ) {
    // 按 providerType 索引，O(1) 查找
    this.providerMap = new Map(providers.map((p) => [p.providerType, p]));
    this.logger.log(`Registered auth providers: ${[...this.providerMap.keys()].join(', ')}`);
  }

  /**
   * 统一登录入口
   * @param providerType - 'wechat' | 'apple' | 'google' | ...
   * @param credentials  - 前端传来的认证凭据
   */
  async login(providerType: string, credentials: AuthCredentials) {
    const provider = this.providerMap.get(providerType);
    if (!provider) {
      throw new UnauthorizedException(
        `不支持的登录方式: ${providerType}。已注册: ${[...this.providerMap.keys()].join(', ')}`,
      );
    }

    // 1. 委托 provider 认证，拿到第三方身份
    const authResult = await provider.authenticate(credentials);

    // 2. 创建/更新本地用户（按 provider + externalId 复合身份键）
    const user = await this.users.upsertByExternalId({
      provider: providerType,
      externalId: authResult.externalId,
      unionid: authResult.unionId,
      nickname: authResult.profile?.nickname,
      avatar: authResult.profile?.avatar,
    });

    // 3. 更新最后登录时间
    user.lastLoginAt = new Date();
    await this.users.save(user);

    // 4. 签发 JWT
    return this.signToken(user);
  }

  // ─── 内部方法 ───────────────────────────────────────────────

  private signToken(user: User) {
    const payload: JwtUserPayload = {
      sub: user.id,
      openid: user.openid ?? undefined,
      role: user.role,
    };
    const token = this.jwt.sign(payload);
    return {
      token,
      user: {
        id: user.id,
        nickname: user.nickname,
        avatar: user.avatar,
        role: user.role,
      },
    };
  }
}

import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import appleSignin, { AppleIdTokenType } from 'apple-signin-auth';
import {
  AuthCredentials,
  AuthProvider,
  AuthResult,
} from '../../../common/interfaces/auth-provider.interface';

/**
 * Apple 登录：校验前端（expo-auth-session）拿到的 identityToken。
 *
 * audience 为 Apple Developer 后台配置的 Services ID（web/AuthSession 流程只有一个）。
 */
@Injectable()
export class AppleAuthProvider implements AuthProvider {
  readonly providerType = 'apple';
  private readonly logger = new Logger(AppleAuthProvider.name);

  constructor(private readonly config: ConfigService) {}

  /** 网络校验隔离点：apple-signin-auth 内部拉取/缓存 Apple JWKS 并校验签名、iss、aud、exp */
  protected verifyToken(idToken: string, audience: string): Promise<AppleIdTokenType> {
    return appleSignin.verifyIdToken(idToken, { audience, ignoreExpiration: false });
  }

  async authenticate(credentials: AuthCredentials): Promise<AuthResult> {
    const audience = this.config.get<string>('APPLE_CLIENT_ID');
    if (!audience) {
      throw new UnauthorizedException('Apple 登录未配置 Client ID');
    }

    let payload: AppleIdTokenType;
    try {
      payload = await this.verifyToken(credentials.code, audience);
    } catch (err) {
      this.logger.warn(`Apple identityToken 校验失败: ${(err as Error).message}`);
      throw new UnauthorizedException('Apple identityToken 校验失败');
    }
    if (!payload?.sub) {
      throw new UnauthorizedException('Apple identityToken 缺少 sub');
    }

    return {
      externalId: payload.sub,
      unionId: null,
      // Apple 的 identityToken 不含姓名；姓名仅首次授权由客户端透传（nickname）。
      // 后续登录 profile 为空时保持 undefined，避免 upsert 覆盖用户已存昵称/头像。
      profile: {
        nickname: credentials.profile?.nickname,
        avatar: credentials.profile?.avatar,
      },
    };
  }
}

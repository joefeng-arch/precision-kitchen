import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client, TokenPayload } from 'google-auth-library';
import {
  AuthCredentials,
  AuthProvider,
  AuthResult,
} from '../../../common/interfaces/auth-provider.interface';

/**
 * Google 登录：校验前端（expo-auth-session）拿到的 idToken。
 *
 * audience 为 iOS / Android / Web 平台 Client ID 白名单（配了几个算几个）——
 * expo-auth-session 按平台用不同 Client ID 发起授权，idToken 的 aud 会是其中之一。
 */
@Injectable()
export class GoogleAuthProvider implements AuthProvider {
  readonly providerType = 'google';
  private readonly logger = new Logger(GoogleAuthProvider.name);
  private readonly oauthClient = new OAuth2Client();

  constructor(private readonly config: ConfigService) {}

  /** 网络校验隔离点：google-auth-library 内部处理 JWKS 拉取/缓存与签名、iss、aud、exp 校验 */
  protected async verifyToken(
    idToken: string,
    audience: string[],
  ): Promise<TokenPayload | undefined> {
    const ticket = await this.oauthClient.verifyIdToken({ idToken, audience });
    return ticket.getPayload();
  }

  async authenticate(credentials: AuthCredentials): Promise<AuthResult> {
    const audience = [
      this.config.get<string>('GOOGLE_IOS_CLIENT_ID'),
      this.config.get<string>('GOOGLE_ANDROID_CLIENT_ID'),
      this.config.get<string>('GOOGLE_WEB_CLIENT_ID'),
    ].filter((v): v is string => !!v);
    if (audience.length === 0) {
      throw new UnauthorizedException('Google 登录未配置 Client ID');
    }

    let payload: TokenPayload | undefined;
    try {
      payload = await this.verifyToken(credentials.code, audience);
    } catch (err) {
      this.logger.warn(`Google idToken 校验失败: ${(err as Error).message}`);
      throw new UnauthorizedException('Google idToken 校验失败');
    }
    if (!payload?.sub) {
      throw new UnauthorizedException('Google idToken 缺少 sub');
    }

    return {
      externalId: payload.sub,
      unionId: null,
      // 透传 profile 优先，其次 token claims；都没有则留 undefined——
      // upsertByExternalId 对 undefined 不覆盖已存值，新建时走默认昵称。
      profile: {
        nickname: credentials.profile?.nickname ?? payload.name,
        avatar: credentials.profile?.avatar ?? payload.picture,
      },
    };
  }
}

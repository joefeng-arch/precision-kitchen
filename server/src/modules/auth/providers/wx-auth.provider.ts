import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AuthProvider,
  AuthCredentials,
  AuthResult,
} from '../../../common/interfaces/auth-provider.interface';

interface WxCode2SessionResp {
  openid?: string;
  unionid?: string;
  session_key?: string;
  errcode?: number;
  errmsg?: string;
}

/**
 * 微信小程序登录 Provider
 *
 * 实现 AuthProvider 接口，将 wx.login() 返回的 code
 * 换取 openid / unionid。dev 环境支持 mock code。
 */
@Injectable()
export class WxAuthProvider implements AuthProvider {
  readonly providerType = 'wechat';
  private readonly logger = new Logger(WxAuthProvider.name);

  constructor(private readonly config: ConfigService) {}

  async authenticate(credentials: AuthCredentials): Promise<AuthResult> {
    const appid = this.config.get<string>('WX_APPID');
    const secret = this.config.get<string>('WX_SECRET');
    const env = this.config.get<string>('NODE_ENV', 'development');
    const allowMock =
      this.config.get<string>(
        'ALLOW_MOCK_LOGIN',
        env === 'production' ? 'false' : 'true',
      ) === 'true';

    const { code, profile } = credentials;
    const isMockCode = code.startsWith('mock-');
    const hasWxCreds = Boolean(appid && secret);

    let openid: string;
    let unionid: string | null = null;

    if (allowMock && (isMockCode || !hasWxCreds)) {
      // ── Dev / Mock 模式 ──
      openid = isMockCode ? code : `mock-${code}`;
      this.logger.warn(`[mock login] openid=${openid}`);
    } else if (!hasWxCreds) {
      throw new UnauthorizedException(
        '微信登录未配置：缺少 WX_APPID / WX_SECRET',
      );
    } else {
      // ── 正式微信 code2session ──
      const r = await this.callWxCode2Session(appid!, secret!, code);
      openid = r.openid;
      unionid = r.unionid ?? null;
    }

    return {
      externalId: openid,
      unionId: unionid,
      profile: profile
        ? { nickname: profile.nickname, avatar: profile.avatar }
        : undefined,
    };
  }

  // ─── 内部方法 ───────────────────────────────────────────────

  private async callWxCode2Session(
    appid: string,
    secret: string,
    code: string,
  ): Promise<{ openid: string; unionid?: string }> {
    const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${appid}&secret=${secret}&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    let data: WxCode2SessionResp;
    try {
      const res = await fetch(url, { signal: controller.signal });
      data = (await res.json()) as WxCode2SessionResp;
    } catch (err) {
      this.logger.error(
        `wx code2session network error: ${(err as Error).message}`,
      );
      throw new UnauthorizedException('微信登录失败：网络异常');
    } finally {
      clearTimeout(timeout);
    }

    if (!data.openid) {
      this.logger.error(`wx code2session failed: ${JSON.stringify(data)}`);
      throw new UnauthorizedException(
        `微信登录失败 [${data.errcode ?? '?'}]: ${data.errmsg ?? 'unknown'}`,
      );
    }
    return { openid: data.openid, unionid: data.unionid };
  }
}

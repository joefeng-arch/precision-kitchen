import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';

const ACCESS_TOKEN_KEY = 'wx:access_token';
/** 7000 秒 — 微信 token 有效期 7200 秒，提前 200 秒刷新 */
const ACCESS_TOKEN_TTL_MS = 7000 * 1000;

@Injectable()
export class WxAccessTokenService {
  private readonly logger = new Logger(WxAccessTokenService.name);

  constructor(
    @Inject(CACHE_MANAGER) private readonly cache: any,
    private readonly config: ConfigService,
  ) {}

  /**
   * 获取微信 access_token，结果缓存到 Redis。
   * 开发环境（ALLOW_MOCK_LOGIN=true）或未配置凭证时抛出友好错误。
   */
  async getAccessToken(): Promise<string> {
    const cached = await this.cache.get(ACCESS_TOKEN_KEY);
    if (cached) return cached as string;

    const appid = this.config.get<string>('WX_APPID') ?? '';
    const secret = this.config.get<string>('WX_SECRET') ?? '';

    if (!appid || !secret || appid === 'your-wx-appid') {
      throw new InternalServerErrorException(
        '未配置 WX_APPID / WX_SECRET，无法调用微信接口',
      );
    }

    const url =
      `https://api.weixin.qq.com/cgi-bin/token` +
      `?grant_type=client_credential&appid=${appid}&secret=${secret}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch(url, { signal: controller.signal });
      const data = (await res.json()) as {
        access_token?: string;
        expires_in?: number;
        errcode?: number;
        errmsg?: string;
      };

      if (!data.access_token) {
        this.logger.error(`wx token 获取失败: ${JSON.stringify(data)}`);
        throw new InternalServerErrorException(
          `获取微信 access_token 失败 [${data.errcode ?? '?'}]`,
        );
      }

      await this.cache.set(ACCESS_TOKEN_KEY, data.access_token, ACCESS_TOKEN_TTL_MS);
      this.logger.log('wx access_token 已刷新并缓存');
      return data.access_token;
    } catch (err) {
      if (err instanceof InternalServerErrorException) throw err;
      this.logger.error(`wx token 网络异常: ${(err as Error).message}`);
      throw new InternalServerErrorException('获取微信凭证网络异常，请稍后重试');
    } finally {
      clearTimeout(timer);
    }
  }
}

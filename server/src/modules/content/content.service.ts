import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WxAccessTokenService } from '../wx/wx-access-token.service';
import { createReadStream } from 'fs';
import FormData from 'form-data';

export interface ContentCheckResult {
  safe: boolean;
  reason?: string;
}

/** 微信 msg_sec_check errcode 说明 */
const WX_ERRCODE_SAFE = 0;
const WX_SAFE_LABEL = 100; // v2 result.label=100 表示无风险
const WX_ERRCODE_RISKY = 87014;

@Injectable()
export class ContentCheckService {
  private readonly logger = new Logger(ContentCheckService.name);

  constructor(
    private readonly wxToken: WxAccessTokenService,
    private readonly config: ConfigService,
  ) {}

  /** 是否处于开发 mock 环境 — 此时跳过内容检查 */
  private get isMockEnv(): boolean {
    return (
      this.config.get<string>('ALLOW_MOCK_LOGIN') === 'true' ||
      this.config.get<string>('NODE_ENV') === 'development'
    );
  }

  /**
   * 检查文本内容安全（调用微信 msg_sec_check）
   * 开发环境直接返回 safe=true
   */
  async checkText(content: string): Promise<ContentCheckResult> {
    if (this.isMockEnv) {
      this.logger.debug('[mock] 跳过文本安全检查');
      return { safe: true };
    }

    let token: string;
    try {
      token = await this.wxToken.getAccessToken();
    } catch (e: any) {
      this.logger.warn(`获取 token 失败，文本检查跳过: ${e.message}`);
      return { safe: true }; // token 获取失败时放行，不阻断用户操作
    }

    const url = `https://api.weixin.qq.com/wxa/msg_sec_check?access_token=${token}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
        signal: controller.signal,
      });

      const data = (await res.json()) as {
        errcode: number;
        errmsg?: string;
        result?: { suggest?: string; label?: number };
      };

      this.logger.debug(`msg_sec_check 响应: ${JSON.stringify(data)}`);

      if (data.errcode === WX_ERRCODE_SAFE) {
        // v1: errcode=0 即通过；v2: 还需检查 result.label
        const label = data.result?.label;
        if (label !== undefined && label !== WX_SAFE_LABEL) {
          return { safe: false, reason: 'risky_content' };
        }
        return { safe: true };
      }

      if (data.errcode === WX_ERRCODE_RISKY) {
        return { safe: false, reason: 'risky_content' };
      }

      // 其他 errcode（系统繁忙等）— 放行，避免误伤
      this.logger.warn(`msg_sec_check 异常 errcode=${data.errcode}，放行`);
      return { safe: true };
    } catch (err: any) {
      this.logger.warn(`msg_sec_check 网络异常: ${err.message}，放行`);
      return { safe: true };
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * 检查图片内容安全（调用微信 img_sec_check）
   * @param filePath 服务器上已存储的图片绝对路径
   */
  async checkImage(filePath: string): Promise<ContentCheckResult> {
    if (this.isMockEnv) {
      this.logger.debug('[mock] 跳过图片安全检查');
      return { safe: true };
    }

    let token: string;
    try {
      token = await this.wxToken.getAccessToken();
    } catch (e: any) {
      this.logger.warn(`获取 token 失败，图片检查跳过: ${e.message}`);
      return { safe: true };
    }

    const url = `https://api.weixin.qq.com/wxa/img_sec_check?access_token=${token}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    try {
      const form = new FormData();
      form.append('media', createReadStream(filePath));

      const res = await fetch(url, {
        method: 'POST',
        body: form as any,
        headers: form.getHeaders(),
        signal: controller.signal,
      });

      const data = (await res.json()) as { errcode: number; errmsg?: string };
      this.logger.debug(`img_sec_check 响应: ${JSON.stringify(data)}`);

      if (data.errcode === WX_ERRCODE_SAFE) return { safe: true };
      if (data.errcode === WX_ERRCODE_RISKY) return { safe: false, reason: 'risky_image' };

      this.logger.warn(`img_sec_check 异常 errcode=${data.errcode}，放行`);
      return { safe: true };
    } catch (err: any) {
      this.logger.warn(`img_sec_check 网络异常: ${err.message}，放行`);
      return { safe: true };
    } finally {
      clearTimeout(timer);
    }
  }
}

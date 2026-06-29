import { Injectable, Logger } from '@nestjs/common';

export interface ContentCheckResult {
  safe: boolean;
  reason?: string;
}

/**
 * 内容安全检查 — 海外版 no-op 实现。
 *
 * 原微信 msg_sec_check / img_sec_check 已移除（海外无微信内容审核）。
 * 当前一律放行；将来如需接入审核（AWS Rekognition / OpenAI Moderation 等），
 * 在此处替换为对应 provider 实现即可——接口 `checkText`/`checkImage` 保持不变，
 * 消费方（content.controller、uploads.controller）零改动。
 */
@Injectable()
export class ContentCheckService {
  private readonly logger = new Logger(ContentCheckService.name);

  async checkText(_content: string): Promise<ContentCheckResult> {
    return { safe: true };
  }

  async checkImage(_filePath: string): Promise<ContentCheckResult> {
    return { safe: true };
  }
}

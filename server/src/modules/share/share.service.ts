import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { randomBytes } from 'crypto';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

import { ShareCode } from './entities/share-code.entity';
import { Recipe } from '../recipes/entities/recipe.entity';
import { WxAccessTokenService } from '../wx/wx-access-token.service';

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
const QRCODE_CACHE_TTL = 86400; // 24h

@Injectable()
export class ShareService {
  private readonly logger = new Logger(ShareService.name);

  constructor(
    @InjectRepository(ShareCode)
    private readonly shareCodeRepo: Repository<ShareCode>,
    @InjectRepository(Recipe)
    private readonly recipeRepo: Repository<Recipe>,
    @Inject(CACHE_MANAGER)
    private readonly cache: any,
    private readonly config: ConfigService,
    private readonly wxToken: WxAccessTokenService,
  ) {
    // Ensure upload directory exists
    if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });
  }

  // ─── Generate QR Code ───────────────────────────────────────
  async generateQrcode(recipeId: string): Promise<{ qrcodeUrl: string; scene: string }> {
    // Check cache first
    const cacheKey = `qrcode:${recipeId}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        // corrupted cache, regenerate
      }
    }

    // Verify recipe exists
    const recipe = await this.recipeRepo.findOneBy({ id: recipeId });
    if (!recipe) {
      throw new NotFoundException('菜谱不存在');
    }

    // Get or create short code
    let shareCode = await this.shareCodeRepo.findOneBy({ recipeId });
    if (!shareCode) {
      const shortCode = this.generateShortCode();
      shareCode = this.shareCodeRepo.create({
        shortCode,
        recipeId,
      });
      shareCode = await this.shareCodeRepo.save(shareCode);
    }

    // If QR was already generated (has url but cache expired), return it
    if (shareCode.qrcodeUrl) {
      const result = { qrcodeUrl: shareCode.qrcodeUrl, scene: shareCode.shortCode };
      await this.cache.set(cacheKey, JSON.stringify(result), QRCODE_CACHE_TTL);
      return result;
    }

    // Generate QR code
    const qrcodeUrl = await this.createQrcodeImage(shareCode.shortCode);

    // Update DB with URL
    await this.shareCodeRepo.update(shareCode.id, { qrcodeUrl });

    const result = { qrcodeUrl, scene: shareCode.shortCode };
    await this.cache.set(cacheKey, JSON.stringify(result), QRCODE_CACHE_TTL);

    return result;
  }

  // ─── Resolve Scene ──────────────────────────────────────────
  async resolveScene(scene: string): Promise<{ recipeId: string }> {
    const shareCode = await this.shareCodeRepo.findOneBy({ shortCode: scene });
    if (!shareCode) {
      throw new NotFoundException('无效的分享码');
    }
    return { recipeId: shareCode.recipeId };
  }

  // ─── WeChat Access Token (delegated to WxAccessTokenService) ──
  private getAccessToken(): Promise<string> {
    return this.wxToken.getAccessToken();
  }

  // ─── Create QR Code Image ──────────────────────────────────
  private async createQrcodeImage(shortCode: string): Promise<string> {
    const appid = this.config.get<string>('WX_APPID');
    const secret = this.config.get<string>('WX_SECRET');
    const env = this.config.get<string>('NODE_ENV', 'development');
    const hasWxCreds = Boolean(appid && secret);

    if (hasWxCreds && env !== 'development') {
      // ── Production: 调用微信 getUnlimited API ──
      return this.createWxacode(shortCode);
    }

    // ── Dev fallback: 生成普通 QR 码 ──
    return this.createFallbackQrcode(shortCode);
  }

  private async createWxacode(shortCode: string): Promise<string> {
    const accessToken = await this.getAccessToken();
    const url = `https://api.weixin.qq.com/wxa/getwxacodeunlimit?access_token=${accessToken}`;

    const body = JSON.stringify({
      scene: shortCode,
      page: 'pages/index/index',
      width: 280,
      env_version: 'release',
      is_hyaline: false,
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: controller.signal,
      });

      const contentType = res.headers.get('content-type') || '';

      // WeChat returns JSON on error, binary image on success
      if (contentType.includes('application/json')) {
        const errData = (await res.json()) as { errcode: number; errmsg: string };
        this.logger.error(`wxacode error: ${JSON.stringify(errData)}`);
        throw new InternalServerErrorException(
          `生成小程序码失败 [${errData.errcode}]: ${errData.errmsg}`,
        );
      }

      // Success — binary PNG
      const buffer = Buffer.from(await res.arrayBuffer());
      const filename = `qrcode-${shortCode}.png`;
      const filepath = join(UPLOAD_DIR, filename);
      writeFileSync(filepath, buffer);

      return `/uploads/${filename}`;
    } catch (err) {
      if (err instanceof InternalServerErrorException) throw err;
      this.logger.error(`wxacode network error: ${(err as Error).message}`);
      throw new InternalServerErrorException('生成小程序码网络异常');
    } finally {
      clearTimeout(timeout);
    }
  }

  private async createFallbackQrcode(shortCode: string): Promise<string> {
    // Dev mode: generate a standard QR code using the 'qrcode' npm package
    try {
      // Dynamic require to avoid hard dependency — qrcode is a dev/fallback-only dep
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const QRCode = require('qrcode') as any;
      const frontendUrl = this.config.get<string>(
        'FRONTEND_URL',
        'http://localhost:5173',
      );
      const shareUrl = `${frontendUrl}?scene=${shortCode}`;
      const buffer = await QRCode.toBuffer(shareUrl, {
        width: 280,
        margin: 2,
        color: { dark: '#ab3500', light: '#ffffff' },
      });

      const filename = `qrcode-${shortCode}.png`;
      const filepath = join(UPLOAD_DIR, filename);
      writeFileSync(filepath, buffer);

      this.logger.warn(`[dev] Generated fallback QR code for scene=${shortCode}`);
      return `/uploads/${filename}`;
    } catch (err) {
      this.logger.error(`Fallback QR generation failed: ${(err as Error).message}`);
      throw new InternalServerErrorException('生成二维码失败');
    }
  }

  // ─── Short Code Generator ─────────────────────────────────
  private generateShortCode(): string {
    // 8 characters, URL-safe: base64url encoding of 6 random bytes
    return randomBytes(6).toString('base64url');
  }
}

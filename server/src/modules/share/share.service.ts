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

  // ─── Create QR Code Image ──────────────────────────────────
  // 标准二维码，指向 H5 分享链接 FRONTEND_URL?scene=<shortCode>。
  // 海外无小程序码，统一用 'qrcode' 包生成普通二维码。
  private async createQrcodeImage(shortCode: string): Promise<string> {
    try {
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

      return `/uploads/${filename}`;
    } catch (err) {
      this.logger.error(`QR generation failed: ${(err as Error).message}`);
      throw new InternalServerErrorException('生成二维码失败');
    }
  }

  // ─── Short Code Generator ─────────────────────────────────
  private generateShortCode(): string {
    // 8 characters, URL-safe: base64url encoding of 6 random bytes
    return randomBytes(6).toString('base64url');
  }
}

import { ForbiddenException, Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Cache } from 'cache-manager';
import { Repository } from 'typeorm';
import {
  FREE_RECIPE_LIMIT,
  PARSE_MONTHLY_LIMIT,
  parseQuotaKey,
  parseQuotaMonth,
} from '../../common/constants/tier-limits';
import { Recipe } from '../recipes/entities/recipe.entity';
import { UserRole } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';

export interface BillingStatus {
  tier: UserRole;
  vipExpiresAt: Date | null;
  quotas: {
    recipes: { used: number; limit: number | null }; // limit null = 无限（PRO）
    aiParse: { used: number; limit: number; month: string };
  };
}

/** PRO entitlement 标识（RevenueCat 后台配置的 entitlement id） */
const PRO_ENTITLEMENT_ID = 'pro';

/** 授予 PRO 的事件类型；NON_RENEWING_PURCHASE = Lifetime 的到达形态 */
const GRANTING_EVENTS = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'UNCANCELLATION',
  'PRODUCT_CHANGE',
  'NON_RENEWING_PURCHASE',
]);
/** 到期前保留权益、仅信息性的事件 */
const NOOP_EVENTS = new Set(['CANCELLATION', 'BILLING_ISSUE']);

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly usersService: UsersService,
    @InjectRepository(Recipe) private readonly recipes: Repository<Recipe>,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  /** Me 页 + Paywall 的单一状态面：层级 + 到期 + 两项配额用量 */
  async getStatus(userId: string, effectiveRole: UserRole): Promise<BillingStatus> {
    const user = await this.usersService.findById(userId);
    const [recipeCount, parseUsed] = await Promise.all([
      this.recipes.count({ where: { authorId: userId } }),
      this.cache.get<number>(parseQuotaKey(userId)),
    ]);
    return {
      tier: effectiveRole,
      vipExpiresAt: user?.vipExpiresAt ?? null,
      quotas: {
        recipes: {
          used: recipeCount,
          limit: effectiveRole === 'vip' ? null : FREE_RECIPE_LIMIT,
        },
        aiParse: {
          used: parseUsed ?? 0,
          limit: PARSE_MONTHLY_LIMIT[effectiveRole],
          month: parseQuotaMonth(),
        },
      },
    };
  }

  /**
   * RevenueCat webhook 事件处理。恒 resolve（controller 恒回 200）：
   * RC 对非 2xx 重试数天，未知用户/未知类型都记日志放行，防重试风暴。
   * setTier 迁移幂等，无需 event-id 去重（接受的缺口：无审计表）。
   */
  async handleRevenueCatEvent(body: unknown): Promise<{ handled: boolean }> {
    const event = (body as { event?: Record<string, unknown> } | null)?.event;
    if (!event || typeof event !== 'object') {
      this.logger.warn('RevenueCat webhook：缺少 event 字段，忽略');
      return { handled: false };
    }

    const type = String(event.type ?? '');
    const appUserId = typeof event.app_user_id === 'string' ? event.app_user_id : null;
    if (!appUserId) {
      this.logger.warn(`RevenueCat webhook：事件 ${type} 缺 app_user_id，忽略`);
      return { handled: false };
    }

    // entitlement_ids 存在时必须包含 'pro'（防止未来其他层级的事件误授）
    const entitlements = Array.isArray(event.entitlement_ids)
      ? (event.entitlement_ids as unknown[]).map(String)
      : null;
    const targetsPro = entitlements === null || entitlements.includes(PRO_ENTITLEMENT_ID);

    try {
      if (GRANTING_EVENTS.has(type) && targetsPro) {
        const ms = event.expiration_at_ms;
        const expiry = typeof ms === 'number' && Number.isFinite(ms) ? new Date(ms) : null;
        await this.usersService.setTier(appUserId, 'vip', expiry);
        this.logger.log(
          `RevenueCat ${type}: ${appUserId} → vip（expiry=${expiry?.toISOString() ?? 'lifetime'}）`,
        );
        return { handled: true };
      }
      if (type === 'EXPIRATION' && targetsPro) {
        await this.usersService.setTier(appUserId, 'user', null);
        this.logger.log(`RevenueCat EXPIRATION: ${appUserId} → user`);
        return { handled: true };
      }
      if (NOOP_EVENTS.has(type)) {
        this.logger.log(`RevenueCat ${type}: ${appUserId} 到期前保留权益，no-op`);
        return { handled: true };
      }
      this.logger.warn(`RevenueCat webhook：未处理的事件类型 ${type}（${appUserId}），忽略`);
      return { handled: false };
    } catch (err) {
      // 未知 app_user_id（用户已删）等：记日志、200 放行，防 RC 重试风暴
      this.logger.warn(
        `RevenueCat webhook：处理 ${type}（${appUserId}）失败：${(err as Error).message}`,
      );
      return { handled: false };
    }
  }

  /** dev 专用：不依赖真实购买本地测 PRO。生产 ALLOW_MOCK_LOGIN=false 时 403。 */
  async mockUpgrade(userId: string): Promise<BillingStatus> {
    this.assertMockAllowed();
    const expiry = new Date(Date.now() + 30 * 86400_000);
    await this.usersService.setTier(userId, 'vip', expiry);
    return this.getStatus(userId, 'vip');
  }

  async mockDowngrade(userId: string): Promise<BillingStatus> {
    this.assertMockAllowed();
    await this.usersService.setTier(userId, 'user', null);
    return this.getStatus(userId, 'user');
  }

  private assertMockAllowed(): void {
    // 与 MockAuthProvider 完全一致的 fail-closed 表达式
    const env = this.config.get<string>('NODE_ENV', 'development');
    const allowMock =
      this.config.get<string>('ALLOW_MOCK_LOGIN', env === 'production' ? 'false' : 'true') ===
      'true';
    if (!allowMock) {
      // 403 而非 401：客户端 apiFetch 对 401 强制登出
      throw new ForbiddenException('Mock billing is disabled (ALLOW_MOCK_LOGIN != true)');
    }
  }
}

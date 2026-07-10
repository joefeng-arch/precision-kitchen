import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { parseQuotaKey } from '../../common/constants/tier-limits';
import { BillingService } from './billing.service';

function fakeConfig(values: Record<string, string> = {}): ConfigService {
  return {
    get: (key: string, def?: string) => values[key] ?? def,
  } as unknown as ConfigService;
}

function makeService(opts?: {
  config?: Record<string, string>;
  recipeCount?: number;
  parseUsed?: number;
  user?: unknown;
}) {
  const usersService: any = {
    setTier: jest.fn().mockResolvedValue({}),
    findById: jest
      .fn()
      .mockResolvedValue(opts?.user ?? { id: 'u1', role: 'user', vipExpiresAt: null }),
  };
  const recipes: any = { count: jest.fn().mockResolvedValue(opts?.recipeCount ?? 0) };
  const store = new Map<string, number>();
  if (opts?.parseUsed != null) store.set(parseQuotaKey('u1'), opts.parseUsed);
  const cache: any = {
    get: async (k: string) => store.get(k),
    set: async (k: string, v: number) => {
      store.set(k, v);
    },
  };
  const svc = new BillingService(
    fakeConfig(opts?.config ?? { ALLOW_MOCK_LOGIN: 'true', NODE_ENV: 'development' }),
    usersService,
    recipes,
    cache,
  );
  return { svc, usersService, recipes, store };
}

describe('BillingService.getStatus', () => {
  it('FREE：recipes 10 上限、aiParse 5 上限、计数回填', async () => {
    const { svc } = makeService({ recipeCount: 3, parseUsed: 2 });
    const s = await svc.getStatus('u1', 'user');
    expect(s.tier).toBe('user');
    expect(s.quotas.recipes).toEqual({ used: 3, limit: 10 });
    expect(s.quotas.aiParse.used).toBe(2);
    expect(s.quotas.aiParse.limit).toBe(5);
  });

  it('VIP：recipes limit null（无限）、aiParse 30、带 vipExpiresAt', async () => {
    const expiry = new Date('2027-01-01T00:00:00Z');
    const { svc } = makeService({
      user: { id: 'u1', role: 'vip', vipExpiresAt: expiry },
      recipeCount: 42,
      parseUsed: 7,
    });
    const s = await svc.getStatus('u1', 'vip');
    expect(s.tier).toBe('vip');
    expect(s.vipExpiresAt).toEqual(expiry);
    expect(s.quotas.recipes).toEqual({ used: 42, limit: null });
    expect(s.quotas.aiParse.limit).toBe(30);
  });

  it('无月度计数键 → used 0', async () => {
    const { svc } = makeService({});
    const s = await svc.getStatus('u1', 'user');
    expect(s.quotas.aiParse.used).toBe(0);
  });
});

describe('BillingService.handleRevenueCatEvent', () => {
  const grantEvent = (overrides: Record<string, unknown> = {}) => ({
    event: {
      id: 'e1',
      type: 'INITIAL_PURCHASE',
      app_user_id: 'u1',
      expiration_at_ms: 1783000000000,
      entitlement_ids: ['pro'],
      ...overrides,
    },
  });

  it('INITIAL_PURCHASE + expiration_at_ms → setTier(vip, Date)', async () => {
    const { svc, usersService } = makeService();
    await svc.handleRevenueCatEvent(grantEvent());
    expect(usersService.setTier).toHaveBeenCalledWith('u1', 'vip', new Date(1783000000000));
  });

  it('RENEWAL 同样授予', async () => {
    const { svc, usersService } = makeService();
    await svc.handleRevenueCatEvent(grantEvent({ type: 'RENEWAL' }));
    expect(usersService.setTier).toHaveBeenCalledWith('u1', 'vip', new Date(1783000000000));
  });

  it('EXPIRATION → setTier(user, null)', async () => {
    const { svc, usersService } = makeService();
    await svc.handleRevenueCatEvent(grantEvent({ type: 'EXPIRATION' }));
    expect(usersService.setTier).toHaveBeenCalledWith('u1', 'user', null);
  });

  it('CANCELLATION → no-op（到期前保留权益）', async () => {
    const { svc, usersService } = makeService();
    await svc.handleRevenueCatEvent(grantEvent({ type: 'CANCELLATION' }));
    expect(usersService.setTier).not.toHaveBeenCalled();
  });

  it('授予事件无 expiration_at_ms → setTier(vip, null)：Lifetime 零改动', async () => {
    const { svc, usersService } = makeService();
    await svc.handleRevenueCatEvent(
      grantEvent({ type: 'NON_RENEWING_PURCHASE', expiration_at_ms: undefined }),
    );
    expect(usersService.setTier).toHaveBeenCalledWith('u1', 'vip', null);
  });

  it('未知事件类型 → resolve 且不 setTier', async () => {
    const { svc, usersService } = makeService();
    await expect(
      svc.handleRevenueCatEvent(grantEvent({ type: 'WEIRD_FUTURE_TYPE' })),
    ).resolves.toBeDefined();
    expect(usersService.setTier).not.toHaveBeenCalled();
  });

  it('未知 app_user_id → resolve（200，防 RC 重试风暴）且不抛', async () => {
    const { svc, usersService } = makeService();
    usersService.setTier.mockRejectedValue(new Error('User not found'));
    await expect(svc.handleRevenueCatEvent(grantEvent())).resolves.toBeDefined();
  });

  it("entitlement_ids 不含 'pro' → 不授予", async () => {
    const { svc, usersService } = makeService();
    await svc.handleRevenueCatEvent(grantEvent({ entitlement_ids: ['other_tier'] }));
    expect(usersService.setTier).not.toHaveBeenCalled();
  });

  it('畸形 body → resolve 不抛', async () => {
    const { svc } = makeService();
    await expect(svc.handleRevenueCatEvent(null)).resolves.toBeDefined();
    await expect(svc.handleRevenueCatEvent({ nonsense: true })).resolves.toBeDefined();
  });
});

describe('BillingService mock 升降级（dev 路径）', () => {
  it('ALLOW_MOCK_LOGIN 关闭 → 403（非 401，401 会登出客户端）', async () => {
    const { svc } = makeService({
      config: { NODE_ENV: 'production' }, // 生产缺省 false
    });
    await expect(svc.mockUpgrade('u1')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(svc.mockDowngrade('u1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('mockUpgrade → setTier(vip, ≈now+30d) 并返回新 status', async () => {
    const { svc, usersService } = makeService();
    const before = Date.now();
    await svc.mockUpgrade('u1');
    const [id, tier, expiry] = usersService.setTier.mock.calls[0];
    expect(id).toBe('u1');
    expect(tier).toBe('vip');
    const delta = (expiry as Date).getTime() - before;
    expect(delta).toBeGreaterThan(29 * 86400_000);
    expect(delta).toBeLessThan(31 * 86400_000);
  });

  it('mockDowngrade → setTier(user, null)', async () => {
    const { svc, usersService } = makeService();
    await svc.mockDowngrade('u1');
    expect(usersService.setTier).toHaveBeenCalledWith('u1', 'user', null);
  });
});

import { render, screen, fireEvent } from '@testing-library/react-native';

import type { BillingStatus } from '@/lib/api/types';

import { BillingSection } from './BillingSection';

const mockRouterPush = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockRouterPush(...args) },
}));

const mockStatus = { data: undefined as BillingStatus | undefined, isLoading: false };
jest.mock('@/lib/api/hooks/useBillingStatus', () => ({
  useBillingStatus: () => mockStatus,
}));

jest.mock('@/lib/store/authStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) =>
    sel({ user: { id: 'u1', nickname: 'Dev', avatar: null, role: 'user' } }),
}));

const FREE_STATUS: BillingStatus = {
  tier: 'user',
  vipExpiresAt: null,
  quotas: {
    recipes: { used: 3, limit: 10 },
    aiParse: { used: 2, limit: 5, month: '2026-07' },
  },
};

const PRO_STATUS: BillingStatus = {
  tier: 'vip',
  vipExpiresAt: '2026-08-08T00:00:00.000Z',
  quotas: {
    recipes: { used: 42, limit: null },
    aiParse: { used: 2, limit: 30, month: '2026-07' },
  },
};

describe('BillingSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStatus.data = undefined;
    mockStatus.isLoading = false;
  });

  it('FREE：徽章 + 配额行 + Upgrade 按钮', async () => {
    mockStatus.data = FREE_STATUS;
    await render(<BillingSection />);
    expect(screen.getByText('FREE')).toBeTruthy();
    expect(screen.getByText('Recipes 3 / 10')).toBeTruthy();
    expect(screen.getByText('AI imports 2 / 5 this month')).toBeTruthy();
    expect(screen.getByText('Upgrade to PRO')).toBeTruthy();
  });

  it('点 Upgrade → push /paywall', async () => {
    mockStatus.data = FREE_STATUS;
    await render(<BillingSection />);
    await fireEvent.press(screen.getByText('Upgrade to PRO'));
    expect(mockRouterPush).toHaveBeenCalledWith('/paywall');
  });

  it('PRO：到期日 + Unlimited + 30 上限，无 Upgrade 按钮', async () => {
    mockStatus.data = PRO_STATUS;
    await render(<BillingSection />);
    expect(screen.getByText('PRO')).toBeTruthy();
    expect(screen.getByText('Recipes 42 / Unlimited')).toBeTruthy();
    expect(screen.getByText('AI imports 2 / 30 this month')).toBeTruthy();
    expect(screen.queryByText('Upgrade to PRO')).toBeNull();
  });

  it('status 未加载 → 回退 authStore role 展示、不崩', async () => {
    mockStatus.isLoading = true;
    await render(<BillingSection />);
    expect(screen.getByText('FREE')).toBeTruthy(); // authStore user.role = 'user'
  });
});

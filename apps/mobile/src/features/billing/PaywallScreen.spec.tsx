import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

import { PaywallScreen } from './PaywallScreen';

const mockRouterBack = jest.fn();
jest.mock('expo-router', () => ({
  router: { back: (...args: unknown[]) => mockRouterBack(...args) },
}));

const mockGetProOffering = jest.fn();
const mockPurchase = jest.fn();
const mockRestore = jest.fn();
const mockConfigured = { value: false };
jest.mock('@/lib/billing/purchases', () => ({
  PRO_PRICES_FALLBACK: { monthly: '$3.99', annual: '$24.99' },
  isPurchasesConfigured: () => mockConfigured.value,
  getProOffering: (...a: unknown[]) => mockGetProOffering(...a),
  purchaseProPackage: (...a: unknown[]) => mockPurchase(...a),
  restorePurchases: (...a: unknown[]) => mockRestore(...a),
}));

const mockMockUpgrade = jest.fn();
jest.mock('@/lib/api/billing', () => ({
  mockUpgrade: (...a: unknown[]) => mockMockUpgrade(...a),
}));

const mockInvalidate = jest.fn();
jest.mock('@/lib/api/queryClient', () => ({
  queryClient: { invalidateQueries: (...a: unknown[]) => mockInvalidate(...a) },
}));

describe('PaywallScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConfigured.value = false;
    mockGetProOffering.mockResolvedValue(null);
  });

  it('权益列表 + 月/年价卡（offering 缺失时 fallback 价）', async () => {
    await render(<PaywallScreen />);
    expect(screen.getByText('Unlimited recipes (free: 10)')).toBeTruthy();
    expect(screen.getByText('30 AI imports / month (free: 5)')).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByText('$3.99')).toBeTruthy();
      expect(screen.getByText('$24.99')).toBeTruthy();
    });
  });

  it('SDK 未配置 → Purchase 禁用 + 提示文案', async () => {
    await render(<PaywallScreen />);
    await waitFor(() => {
      expect(screen.getByText(/Purchases unavailable/)).toBeTruthy();
    });
    expect(
      screen.getByText('Subscribe monthly').parent?.parent?.props.accessibilityState?.disabled ??
        screen.getByText('Subscribe monthly'),
    ).toBeTruthy();
    await fireEvent.press(screen.getByText('Subscribe monthly'));
    expect(mockPurchase).not.toHaveBeenCalled();
  });

  it('dev Mock upgrade → mockUpgrade + invalidate billing + back', async () => {
    mockMockUpgrade.mockResolvedValue({ tier: 'vip' });
    await render(<PaywallScreen />);
    await fireEvent.press(screen.getByText('Mock upgrade (dev)'));
    await waitFor(() => {
      expect(mockMockUpgrade).toHaveBeenCalled();
      expect(mockInvalidate).toHaveBeenCalledWith({ queryKey: ['billing'] });
      expect(mockRouterBack).toHaveBeenCalled();
    });
  });

  it('Restore purchases 按钮存在并调 wrapper', async () => {
    mockRestore.mockResolvedValue({ hasPro: false });
    await render(<PaywallScreen />);
    await fireEvent.press(screen.getByText('Restore purchases'));
    expect(mockRestore).toHaveBeenCalled();
  });

  it('购买成功（已配置 + offering 可用）→ invalidate + back', async () => {
    mockConfigured.value = true;
    mockGetProOffering.mockResolvedValue({
      monthly: { identifier: 'm', product: { priceString: '$3.99' } },
      annual: { identifier: 'a', product: { priceString: '$24.99' } },
    });
    mockPurchase.mockResolvedValue({ hasPro: true });
    await render(<PaywallScreen />);
    await waitFor(() => expect(screen.getByText('$3.99')).toBeTruthy());

    await fireEvent.press(screen.getByText('Subscribe monthly'));
    await waitFor(() => {
      expect(mockPurchase).toHaveBeenCalled();
      expect(mockInvalidate).toHaveBeenCalledWith({ queryKey: ['billing'] });
      expect(mockRouterBack).toHaveBeenCalled();
    });
  });
});

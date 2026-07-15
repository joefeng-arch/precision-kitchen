import { render, screen, fireEvent } from '@testing-library/react-native';

import { ApiClientError } from '@/lib/api/errors';
import type { CostBreakdown } from '@/lib/api/types';

import { CostSummary } from './CostSummary';

const mockRouterPush = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockRouterPush(...args) },
}));

const mockCost = {
  data: undefined as CostBreakdown | undefined,
  error: null as unknown,
  isFetching: false,
};
jest.mock('@/lib/api/hooks/useRecipeCost', () => ({
  useRecipeCost: () => mockCost,
}));

const BREAKDOWN: CostBreakdown = {
  currency: 'USD',
  totalCost: 3.85,
  unknownCount: 1, // 与 lines 一致：两行中一行 unknown

  lines: [
    {
      ingredientId: 5,
      name: 'Bread flour',
      amount: 650,
      unit: 'g',
      unitPrice: 0.004,
      priceUnit: 'g',
      totalCost: 2.6,
      source: 'user_lib',
    },
    {
      ingredientId: null,
      name: 'Mystery spice',
      amount: 5,
      unit: 'g',
      unitPrice: null,
      priceUnit: null,
      totalCost: 0,
      source: 'unknown',
    },
  ],
};

function apiError(code: number): ApiClientError {
  return new ApiClientError({
    code,
    message: 'err',
    path: '/api/cooking/cost',
    timestamp: '',
  });
}

describe('CostSummary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCost.data = undefined;
    mockCost.error = null;
    mockCost.isFetching = false;
  });

  it('成功：总价 + 币种符号 + unpriced 提示', async () => {
    mockCost.data = BREAKDOWN;
    await render(<CostSummary recipeId="r1" scale={null} />);

    expect(screen.getByText('$3.85')).toBeTruthy();
    expect(screen.getByText(/1 ingredient unpriced/)).toBeTruthy();
  });

  it('全部 unpriced → 总价位显示 —（非误导性 $0.00）+ 引导文案', async () => {
    mockCost.data = {
      currency: 'USD',
      totalCost: 0,
      unknownCount: 2,
      lines: BREAKDOWN.lines.map((l) => ({
        ...l,
        unitPrice: null,
        priceUnit: null,
        totalCost: 0,
        source: 'unknown' as const,
      })),
    };
    await render(<CostSummary recipeId="r1" scale={null} />);

    expect(screen.queryByText('$0.00')).toBeNull();
    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.getByText(/Add pantry prices to estimate/)).toBeTruthy();
  });

  it('部分定价（total 恰为 0 但有已定价行）→ 仍显示 $0.00 正常路径', async () => {
    mockCost.data = {
      currency: 'USD',
      totalCost: 0,
      unknownCount: 1,
      lines: [
        { ...BREAKDOWN.lines[0], totalCost: 0, unitPrice: 0, priceUnit: 'g' },
        BREAKDOWN.lines[1],
      ],
    };
    await render(<CostSummary recipeId="r1" scale={null} />);

    expect(screen.getByText('$0.00')).toBeTruthy();
    expect(screen.getByText(/1 ingredient unpriced/)).toBeTruthy();
  });

  it('展开 → 逐行明细，unknown 行显示 —', async () => {
    mockCost.data = BREAKDOWN;
    await render(<CostSummary recipeId="r1" scale={null} />);

    await fireEvent.press(screen.getByText('Estimated cost'));

    expect(screen.getByText('Bread flour')).toBeTruthy();
    expect(screen.getByText('$2.60')).toBeTruthy();
    expect(screen.getByText('Mystery spice')).toBeTruthy();
    expect(screen.getByText('—')).toBeTruthy();
  });

  it('403（PRO 门禁）→ 锁定 CTA → push /paywall', async () => {
    mockCost.error = apiError(403);
    await render(<CostSummary recipeId="r1" scale={null} />);

    expect(screen.getByText('Cost insights are a PRO feature')).toBeTruthy();
    await fireEvent.press(screen.getByText('Upgrade to PRO'));
    expect(mockRouterPush).toHaveBeenCalledWith('/paywall');
  });

  it('非 403 错误 → 安静单行，不渲染锁定 CTA', async () => {
    mockCost.error = apiError(500);
    await render(<CostSummary recipeId="r1" scale={null} />);

    expect(screen.getByText('Cost estimate unavailable.')).toBeTruthy();
    expect(screen.queryByText('Upgrade to PRO')).toBeNull();
  });

  it('加载中 → 占位文案', async () => {
    await render(<CostSummary recipeId="r1" scale={null} />);
    expect(screen.getByText('Estimating cost...')).toBeTruthy();
  });
});

import { render } from '@testing-library/react-native';

import type { RecipeDetail } from '@/lib/api/types';

import { BakersPercentageControls } from './BakersPercentageControls';
import { clearLastScales, setLastScale } from './lastScale';

const mockMutate = jest.fn();
jest.mock('@/lib/api/hooks/useScaleRecipe', () => ({
  useScaleRecipe: () => ({
    mutate: (...args: unknown[]) => mockMutate(...args),
    data: undefined,
    error: null,
    isPending: false,
    variables: undefined,
  }),
}));
jest.mock('@/features/cost/CostSummary', () => ({ CostSummary: () => null }));
jest.mock('./RatioRuler', () => ({ RatioRuler: () => null }));

const RECIPE = {
  id: 'r-bakers',
  title: 'Loaf',
  scalingProfile: 'bakers_percentage',
  ingredients: [
    {
      id: 1,
      name: 'Flour',
      amount: '500',
      unit: 'g',
      scalingRole: 'anchor',
      groupName: null,
    },
    {
      id: 2,
      name: 'Water',
      amount: '325',
      unit: 'g',
      scalingRole: 'percentage',
      groupName: null,
    },
  ],
} as unknown as RecipeDetail;

describe('BakersPercentageControls — 会话内缩放留存', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearLastScales();
  });

  it('无留存 → mount 不发缩放请求', async () => {
    await render(<BakersPercentageControls recipe={RECIPE} />);
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('有留存 → mount 以上次锁定值恢复一次', async () => {
    setLastScale('r-bakers', {
      body: { profile: 'bakers_percentage', bakersLock: { mode: 'total', value: 1680 } },
    });

    await render(<BakersPercentageControls recipe={RECIPE} />);

    expect(mockMutate).toHaveBeenCalledTimes(1);
    expect(mockMutate).toHaveBeenCalledWith({
      id: 'r-bakers',
      body: { profile: 'bakers_percentage', bakersLock: { mode: 'total', value: 1680 } },
    });
  });

  it('其它 profile 的留存体不误用', async () => {
    setLastScale('r-bakers', { body: { profile: 'linear_legacy', multiplier: 2 } });
    await render(<BakersPercentageControls recipe={RECIPE} />);
    expect(mockMutate).not.toHaveBeenCalled();
  });
});

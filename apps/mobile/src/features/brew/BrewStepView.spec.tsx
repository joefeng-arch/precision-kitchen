import { render, screen } from '@testing-library/react-native';

import type { RecipeStep } from '@/lib/api/types';

import { BrewStepView } from './BrewStepView';

function step(overrides: Partial<RecipeStep> = {}): RecipeStep {
  return {
    id: 1,
    recipeId: 'r-1',
    stepNumber: 2,
    description: '下冰糖小火炒至焦糖色',
    imageUrl: null,
    durationSeconds: null,
    tips: null,
    warning: null,
    ...overrides,
  };
}

async function renderStep(s: RecipeStep) {
  await render(
    <BrewStepView
      step={s}
      nextStep={null}
      displaySeconds={null}
      timerStatus={null}
      isLastStep={false}
      onPause={jest.fn()}
      onResume={jest.fn()}
      onAdvance={jest.fn()}
    />,
  );
}

describe('BrewStepView — 步骤 warning 展示', () => {
  it('有 warning：CRITICAL 标签与警示文案可见', async () => {
    await renderStep(step({ warning: '糖色一变琥珀色立刻下肉，晚几秒就发苦' }));
    expect(screen.getByText('CRITICAL')).toBeTruthy();
    expect(screen.getByText('糖色一变琥珀色立刻下肉，晚几秒就发苦')).toBeTruthy();
  });

  it('无 warning：不渲染 CRITICAL callout', async () => {
    await renderStep(step());
    expect(screen.queryByText('CRITICAL')).toBeNull();
  });

  it('warning 与 tips 并存：两者都渲染', async () => {
    await renderStep(
      step({
        warning: '糖色一变琥珀色立刻下肉，晚几秒就发苦',
        tips: '冰糖一定要小火慢炒',
      }),
    );
    expect(screen.getByText('CRITICAL')).toBeTruthy();
    expect(screen.getByText('糖色一变琥珀色立刻下肉，晚几秒就发苦')).toBeTruthy();
    expect(screen.getByText('冰糖一定要小火慢炒')).toBeTruthy();
  });
});

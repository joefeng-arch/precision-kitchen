import { clearLastScales, getLastScale, setLastScale } from './lastScale';

describe('lastScale（会话内缩放留存）', () => {
  beforeEach(() => clearLastScales());

  it('未设置 → undefined', () => {
    expect(getLastScale('r1')).toBeUndefined();
  });

  it('set 后可取回；按 recipeId 隔离', () => {
    setLastScale('r1', { servings: 4 });
    setLastScale('r2', { body: { profile: 'linear_legacy', multiplier: 2 } });

    expect(getLastScale('r1')).toEqual({ servings: 4 });
    expect(getLastScale('r2')?.body).toEqual({ profile: 'linear_legacy', multiplier: 2 });
  });

  it('同 recipeId 覆盖为最新', () => {
    setLastScale('r1', { servings: 4 });
    setLastScale('r1', { servings: 6 });
    expect(getLastScale('r1')).toEqual({ servings: 6 });
  });
});

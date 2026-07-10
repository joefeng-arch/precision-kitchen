import { currencySymbol, deriveLinearScale, formatMoney } from './deriveCostScale';

describe('deriveLinearScale', () => {
  it('servings / baseServings → multiplier', () => {
    expect(deriveLinearScale(6, 4)).toEqual({ profile: 'linear_legacy', multiplier: 1.5 });
  });

  it('无效输入 → null（未拖动 / 除零守卫）', () => {
    expect(deriveLinearScale(undefined, 4)).toBeNull();
    expect(deriveLinearScale(0, 4)).toBeNull();
    expect(deriveLinearScale(2, 0)).toBeNull();
    expect(deriveLinearScale(NaN, 4)).toBeNull();
  });
});

describe('currencySymbol / formatMoney', () => {
  it('已知币种映射符号', () => {
    expect(currencySymbol('CNY')).toBe('¥');
    expect(currencySymbol('USD')).toBe('$');
  });

  it('未知币种回显 code', () => {
    expect(currencySymbol('CAD')).toBe('CAD');
  });

  it('formatMoney 固定 2 位小数', () => {
    expect(formatMoney('USD', 3.8)).toBe('$3.80');
    expect(formatMoney('CNY', 25)).toBe('¥25.00');
  });
});

import { calculateScaledAmount, roundAmount } from './scaling-calculator';

describe('calculateScaledAmount', () => {
  it('linear scales proportionally', () => {
    expect(calculateScaledAmount(100, 2, 'linear')).toBe(200);
    expect(calculateScaledAmount(100, 0.5, 'linear')).toBe(50);
  });

  it('fixed ignores multiplier', () => {
    expect(calculateScaledAmount(3, 4, 'fixed')).toBe(3);
    expect(calculateScaledAmount(3, 0.1, 'fixed')).toBe(3);
  });

  it('sub_linear uses pow(multiplier, scaleFactor)', () => {
    // 100 * 2^0.7 ≈ 162.45
    expect(calculateScaledAmount(100, 2, 'sub_linear')).toBeCloseTo(162.45, 1);
    // multiplier=1 always returns base
    expect(calculateScaledAmount(100, 1, 'sub_linear')).toBe(100);
  });

  it('sub_linear respects custom scaleFactor', () => {
    // factor=1 degenerates to linear
    expect(calculateScaledAmount(100, 3, 'sub_linear', 1)).toBeCloseTo(300, 5);
    // factor=0 → multiplier^0 = 1 → base
    expect(calculateScaledAmount(100, 3, 'sub_linear', 0)).toBe(100);
  });
});

describe('roundAmount', () => {
  it('rounds to 2 decimals when < 1', () => {
    expect(roundAmount(0.123)).toBe(0.12);
    expect(roundAmount(0.567)).toBe(0.57);
  });

  it('rounds to 1 decimal when < 10', () => {
    expect(roundAmount(2.34)).toBe(2.3);
    expect(roundAmount(9.96)).toBe(10);
  });

  it('rounds to integer when >= 10', () => {
    expect(roundAmount(123.4)).toBe(123);
    expect(roundAmount(99.5)).toBe(100);
  });
});

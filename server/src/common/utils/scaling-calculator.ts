/**
 * 动态换算引擎核心算法
 * - linear: 线性等比（主料、液体）
 * - sub_linear: 亚线性（调味料、香料），用幂函数减缓
 * - fixed: 不变（蒜瓣、姜片、葱段等小量基础）
 */

export type ScaleType = 'linear' | 'sub_linear' | 'fixed';

export interface ScaledIngredient {
  ingredientId: number | string;
  name: string;
  originalAmount: number;
  scaledAmount: number;
  unit: string;
  scaleType: ScaleType;
}

export function calculateScaledAmount(
  baseAmount: number,
  multiplier: number,
  scaleType: ScaleType,
  scaleFactor: number = 0.7,
): number {
  switch (scaleType) {
    case 'linear':
      return baseAmount * multiplier;
    case 'sub_linear':
      return baseAmount * Math.pow(multiplier, scaleFactor);
    case 'fixed':
      return baseAmount;
  }
}

export function roundAmount(value: number): number {
  if (value < 1) return Math.round(value * 100) / 100;
  if (value < 10) return Math.round(value * 10) / 10;
  return Math.round(value);
}

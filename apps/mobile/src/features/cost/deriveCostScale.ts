import type { ScaleRequest } from '@/lib/api/types';

/**
 * ServingsRuler（linear_legacy）走 GET ?servings= 的 legacy 缩放，variables 里只有份数；
 * 成本端点吃的是锁定式判别体——这里换算成等价的 multiplier。
 */
export function deriveLinearScale(
  servings: number | undefined,
  baseServings: number,
): ScaleRequest | null {
  if (
    servings == null ||
    !Number.isFinite(servings) ||
    servings <= 0 ||
    !Number.isFinite(baseServings) ||
    baseServings <= 0
  ) {
    return null;
  }
  return { profile: 'linear_legacy', multiplier: servings / baseServings };
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  CNY: '¥',
  USD: '$',
  EUR: '€',
  GBP: '£',
};

/** 未知币种回显 code 本身（"CAD3.85" 好过错误符号） */
export function currencySymbol(code: string): string {
  return CURRENCY_SYMBOLS[code] ?? code;
}

export function formatMoney(code: string, value: number): string {
  return `${currencySymbol(code)}${value.toFixed(2)}`;
}

/**
 * 单位换算：把任意中文/英文单位标准化成 g (重量) / ml (体积) / 个 (计数)。
 *
 * 设计原则：
 * - 用户录入 "2 斤"，扣减时统一换成 1000g 再比对菜谱的 "200g"
 * - 不认识的单位 → 返回 null，调用方降级为「单位不匹配，跳过扣减」
 * - 大小写、空格、繁简一律 normalize
 */

export type CanonicalUnit = 'g' | 'ml' | 'count';

export interface NormalizedAmount {
  amount: number; // 已换算到 canonical 单位的数值
  unit: CanonicalUnit;
}

const WEIGHT_TO_G: Record<string, number> = {
  g: 1,
  gram: 1,
  grams: 1,
  克: 1,
  kg: 1000,
  千克: 1000,
  公斤: 1000,
  mg: 0.001,
  毫克: 0.001,
  斤: 500,
  市斤: 500,
  两: 50,
  钱: 5,
  lb: 453.592,
  pound: 453.592,
  oz: 28.3495,
  ounce: 28.3495,
};

const VOLUME_TO_ML: Record<string, number> = {
  ml: 1,
  毫升: 1,
  l: 1000,
  升: 1000,
  cl: 10,
  // 厨房常见近似（仁者见仁，先给个标准值）
  tsp: 5,
  茶匙: 5,
  小勺: 5,
  tbsp: 15,
  汤匙: 15,
  大勺: 15,
  勺: 15,
  cup: 240,
  杯: 240,
};

const COUNT_UNITS = new Set([
  '个',
  '只',
  '颗',
  '粒',
  '块',
  '片',
  '根',
  '条',
  '瓣',
  '朵',
  '把',
  '束',
  'pcs',
  'piece',
  'pieces',
]);

function clean(u: string | null | undefined): string {
  return (u ?? '').toString().trim().toLowerCase();
}

export function normalizeUnit(
  amount: number,
  unit: string | null | undefined,
): NormalizedAmount | null {
  if (!isFinite(amount)) return null;
  const u = clean(unit);
  if (!u) return null;

  if (WEIGHT_TO_G[u] !== undefined) {
    return { amount: amount * WEIGHT_TO_G[u], unit: 'g' };
  }
  if (VOLUME_TO_ML[u] !== undefined) {
    return { amount: amount * VOLUME_TO_ML[u], unit: 'ml' };
  }
  if (COUNT_UNITS.has(u)) {
    return { amount, unit: 'count' };
  }
  return null;
}

/** 把一个值在 canonical 单位下表达得更人类可读 (e.g. 1500g → "1.5kg") */
export function prettyAmount(n: NormalizedAmount): string {
  if (n.unit === 'g') {
    if (n.amount >= 1000) return `${(n.amount / 1000).toFixed(2)}kg`;
    return `${Math.round(n.amount * 10) / 10}g`;
  }
  if (n.unit === 'ml') {
    if (n.amount >= 1000) return `${(n.amount / 1000).toFixed(2)}L`;
    return `${Math.round(n.amount * 10) / 10}ml`;
  }
  return `${Math.round(n.amount * 10) / 10}个`;
}

/**
 * 食材名归一化：去全部空白 + 小写。归一化后**全等**才算匹配——
 * 无子串/前缀/模糊（"糖粉"≠"糖"），错误匹配比不匹配更糟。
 * stock-deduction（库存扣减）与 cost-calculator（成本估算）共用。
 */
export function normName(s: string): string {
  return s.replace(/\s+/g, '').toLowerCase();
}

/**
 * 单位换算工具
 * 重量基准: 克(g) | 体积基准: 毫升(ml)
 */

export type UnitCategory = 'weight' | 'volume' | 'count' | 'unknown';

const WEIGHT_TO_GRAM: Record<string, number> = {
  g: 1,
  克: 1,
  kg: 1000,
  千克: 1000,
  公斤: 1000,
  斤: 500,
  两: 50,
  mg: 0.001,
  毫克: 0.001,
};

const VOLUME_TO_ML: Record<string, number> = {
  ml: 1,
  毫升: 1,
  l: 1000,
  升: 1000,
  cc: 1,
  汤匙: 15,
  茶匙: 5,
  杯: 240,
};

export function getCategory(unit: string): UnitCategory {
  const u = unit.toLowerCase().trim();
  if (u in WEIGHT_TO_GRAM) return 'weight';
  if (u in VOLUME_TO_ML) return 'volume';
  if (['个', '颗', '只', '片', '块', '根', '瓣'].includes(u)) return 'count';
  return 'unknown';
}

export function toBase(amount: number, unit: string): { value: number; baseUnit: string } | null {
  const u = unit.toLowerCase().trim();
  if (u in WEIGHT_TO_GRAM) return { value: amount * WEIGHT_TO_GRAM[u], baseUnit: 'g' };
  if (u in VOLUME_TO_ML) return { value: amount * VOLUME_TO_ML[u], baseUnit: 'ml' };
  return null;
}

export function convert(amount: number, fromUnit: string, toUnit: string): number | null {
  const from = toBase(amount, fromUnit);
  const to = toBase(1, toUnit);
  if (!from || !to || from.baseUnit !== to.baseUnit) return null;
  return from.value / to.value;
}

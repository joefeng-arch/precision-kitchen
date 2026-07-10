import type { CategoryView, UserIngredientView } from '@/lib/api/types';

export const OTHER_SECTION = 'Other';

export interface PantrySection {
  title: string;
  data: UserIngredientView[];
}

/**
 * 已耗尽 = 明确记了 0 库存。stockAmount null 是「没在跟踪库存」，
 * 不是耗尽——Number(null) === 0，必须先判 null。
 */
export function isDepleted(item: UserIngredientView): boolean {
  return item.stockAmount != null && Number(item.stockAmount) === 0;
}

/**
 * 按 categoryName 分组为 SectionList sections。
 * section 顺序：categories 参数序（server 已按 sort ASC 返回，海外预设 sort 为负排最前）
 * → 未知分类名按首次出现序 → 无分类归 Other 置底。
 */
export function groupPantryItems(
  items: UserIngredientView[],
  categories: CategoryView[],
): PantrySection[] {
  const byName = new Map<string, UserIngredientView[]>();
  for (const item of items) {
    const key = item.categoryName ?? OTHER_SECTION;
    const bucket = byName.get(key);
    if (bucket) bucket.push(item);
    else byName.set(key, [item]);
  }

  const known = categories.map((c) => c.name).filter((name) => byName.has(name));
  const unknown = [...byName.keys()].filter(
    (name) => name !== OTHER_SECTION && !known.includes(name),
  );
  const ordered = [...known, ...unknown, ...(byName.has(OTHER_SECTION) ? [OTHER_SECTION] : [])];

  return ordered.map((title) => ({ title, data: byName.get(title)! }));
}

import { groupPantryItems, isDepleted, OTHER_SECTION } from './groupPantryItems';
import type { CategoryView, UserIngredientView } from '@/lib/api/types';

function item(partial: Partial<UserIngredientView>): UserIngredientView {
  return {
    id: 1,
    userId: 'u1',
    ingredientId: null,
    customName: 'Flour',
    unitPrice: '0.0040',
    priceUnit: 'g',
    stockAmount: null,
    stockUnit: null,
    notes: null,
    expiryDate: null,
    storageType: null,
    categoryId: null,
    createdAt: '2026-07-10T00:00:00Z',
    updatedAt: '2026-07-10T00:00:00Z',
    publicName: null,
    categoryName: null,
    ...partial,
  };
}

function category(name: string, sort: number): CategoryView {
  return {
    id: sort,
    type: 'ingredient',
    name,
    icon: null,
    sort,
    enabled: true,
    ownerId: null,
    createdAt: '',
    updatedAt: '',
  };
}

// server 已按 sort ASC 返回 categories；这里模拟海外预设在前
const CATEGORIES = [
  category('Baking Bench', -30),
  category('Bean Vault', -20),
  category('Bar Cabinet', -10),
];

describe('groupPantryItems', () => {
  it('按 categoryName 分组，section 顺序跟随 categories 顺序', () => {
    const sections = groupPantryItems(
      [
        item({ id: 1, categoryName: 'Bean Vault' }),
        item({ id: 2, categoryName: 'Baking Bench' }),
        item({ id: 3, categoryName: 'Baking Bench' }),
      ],
      CATEGORIES,
    );

    expect(sections.map((s) => s.title)).toEqual(['Baking Bench', 'Bean Vault']);
    expect(sections[0].data.map((i) => i.id)).toEqual([2, 3]);
  });

  it('categoryName 为 null 的归 Other 且置底', () => {
    const sections = groupPantryItems(
      [item({ id: 1, categoryName: null }), item({ id: 2, categoryName: 'Bar Cabinet' })],
      CATEGORIES,
    );

    expect(sections.map((s) => s.title)).toEqual(['Bar Cabinet', OTHER_SECTION]);
  });

  it('不在 categories 列表中的分类名排在已知分类后、Other 前', () => {
    const sections = groupPantryItems(
      [
        item({ id: 1, categoryName: null }),
        item({ id: 2, categoryName: '蔬菜' }),
        item({ id: 3, categoryName: 'Baking Bench' }),
      ],
      CATEGORIES,
    );

    expect(sections.map((s) => s.title)).toEqual(['Baking Bench', '蔬菜', OTHER_SECTION]);
  });

  it('空列表 → 空 sections', () => {
    expect(groupPantryItems([], CATEGORIES)).toEqual([]);
  });
});

describe('isDepleted', () => {
  it('"0.00" / "0" → true', () => {
    expect(isDepleted(item({ stockAmount: '0.00' }))).toBe(true);
    expect(isDepleted(item({ stockAmount: '0' }))).toBe(true);
  });

  it('null = 未跟踪库存 ≠ 已耗尽（Number(null)===0 陷阱）', () => {
    expect(isDepleted(item({ stockAmount: null }))).toBe(false);
  });

  it('有库存 → false', () => {
    expect(isDepleted(item({ stockAmount: '5.00' }))).toBe(false);
  });
});

import { render, screen, fireEvent } from '@testing-library/react-native';

import type { CategoryView, UserIngredientView } from '@/lib/api/types';

import { PantryScreen } from './PantryScreen';

const mockRouterPush = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockRouterPush(...args) },
}));

const mockPantry = {
  data: undefined as UserIngredientView[] | undefined,
  error: null as unknown,
  isLoading: false,
  isRefetching: false,
  refetch: jest.fn(),
};
jest.mock('@/lib/api/hooks/usePantryList', () => ({
  usePantryList: () => mockPantry,
}));

const mockCategories = { data: undefined as CategoryView[] | undefined, error: null as unknown };
jest.mock('@/lib/api/hooks/useIngredientCategories', () => ({
  useIngredientCategories: () => mockCategories,
}));

function item(partial: Partial<UserIngredientView>): UserIngredientView {
  return {
    id: 1,
    userId: 'u1',
    ingredientId: null,
    customName: 'Bread flour',
    unitPrice: '0.0040',
    priceUnit: 'g',
    stockAmount: null,
    stockUnit: null,
    notes: null,
    expiryDate: null,
    storageType: null,
    categoryId: null,
    createdAt: '',
    updatedAt: '',
    publicName: null,
    categoryName: null,
    ...partial,
  };
}

const CATEGORIES: CategoryView[] = [
  {
    id: 1,
    type: 'ingredient',
    name: 'Baking Bench',
    icon: null,
    sort: -30,
    enabled: true,
    ownerId: null,
    createdAt: '',
    updatedAt: '',
  },
];

describe('PantryScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPantry.data = undefined;
    mockPantry.error = null;
    mockPantry.isLoading = false;
    mockCategories.data = CATEGORIES;
  });

  it('按分类分区渲染行：名称 + 单价/单位 + 库存', async () => {
    mockPantry.data = [
      item({ id: 1, categoryName: 'Baking Bench', stockAmount: '500.00', stockUnit: 'g' }),
      item({ id: 2, customName: 'Mystery sauce', categoryName: null, unitPrice: '2.5000' }),
    ];
    await render(<PantryScreen />);

    expect(screen.getByText('Baking Bench')).toBeTruthy();
    expect(screen.getByText('Other')).toBeTruthy();
    expect(screen.getByText('Bread flour')).toBeTruthy();
    expect(screen.getByText('0.004 / g')).toBeTruthy();
    expect(screen.getByText('500 g')).toBeTruthy();
  });

  it('stockAmount 为 0 → Depleted 标记；null 不标', async () => {
    mockPantry.data = [
      item({ id: 1, stockAmount: '0.00' }),
      item({ id: 2, customName: 'Salt', stockAmount: null }),
    ];
    await render(<PantryScreen />);

    expect(screen.getAllByText('Depleted')).toHaveLength(1);
  });

  it('空原料库 → 空态提示', async () => {
    mockPantry.data = [];
    await render(<PantryScreen />);
    expect(screen.getByText('Your pantry is empty.')).toBeTruthy();
  });

  it('Add ingredient → push /pantry/new；点行 → push 编辑页', async () => {
    mockPantry.data = [item({ id: 7 })];
    await render(<PantryScreen />);

    await fireEvent.press(screen.getByText('Add ingredient'));
    expect(mockRouterPush).toHaveBeenCalledWith('/pantry/new');

    await fireEvent.press(screen.getByText('Bread flour'));
    expect(mockRouterPush).toHaveBeenCalledWith({
      pathname: '/pantry/[id]',
      params: { id: '7' },
    });
  });
});

import { getAllMyIngredients, PANTRY_MAX_PAGES, PANTRY_PAGE_SIZE } from './pantry';
import { apiFetch } from './client';
import type { Paginated, UserIngredientView } from './types';

jest.mock('./client', () => ({ apiFetch: jest.fn() }));
const mockedFetch = apiFetch as jest.MockedFunction<typeof apiFetch>;

function page(items: number[], totalPages: number): Paginated<UserIngredientView> {
  return {
    items: items.map((id) => ({ id }) as UserIngredientView),
    total: items.length * totalPages,
    page: 1,
    pageSize: PANTRY_PAGE_SIZE,
    totalPages,
  };
}

describe('getAllMyIngredients（分组需全量：翻页循环）', () => {
  beforeEach(() => mockedFetch.mockReset());

  it('单页：只发一次请求', async () => {
    mockedFetch.mockResolvedValueOnce(page([1, 2], 1));

    const items = await getAllMyIngredients();

    expect(mockedFetch).toHaveBeenCalledTimes(1);
    expect(mockedFetch).toHaveBeenCalledWith(
      `/me/ingredients?page=1&pageSize=${PANTRY_PAGE_SIZE}`,
    );
    expect(items.map((i) => i.id)).toEqual([1, 2]);
  });

  it('totalPages=3：三次请求按页拼接', async () => {
    mockedFetch
      .mockResolvedValueOnce(page([1], 3))
      .mockResolvedValueOnce(page([2], 3))
      .mockResolvedValueOnce(page([3], 3));

    const items = await getAllMyIngredients();

    expect(mockedFetch).toHaveBeenCalledTimes(3);
    expect(mockedFetch).toHaveBeenNthCalledWith(
      2,
      `/me/ingredients?page=2&pageSize=${PANTRY_PAGE_SIZE}`,
    );
    expect(items.map((i) => i.id)).toEqual([1, 2, 3]);
  });

  it(`超长列表封顶 ${PANTRY_MAX_PAGES} 页`, async () => {
    mockedFetch.mockResolvedValue(page([9], 99));

    await getAllMyIngredients();

    expect(mockedFetch).toHaveBeenCalledTimes(PANTRY_MAX_PAGES);
  });
});

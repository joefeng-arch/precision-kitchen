import { apiFetch } from './client';
import type {
  CategoryView,
  CreateUserIngredientRequest,
  ListUserIngredientsParams,
  Paginated,
  PublicIngredient,
  UpdateUserIngredientRequest,
  UserIngredientView,
} from './types';

// 注意：unitPrice/stockAmount 等 decimal 字符串字段在这一层保持原样，
// 转换留到使用点；create/update 请求体则发 number（契约 §10）。

function toQueryString(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value != null) search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export function getMyIngredients(params: ListUserIngredientsParams = {}) {
  return apiFetch<Paginated<UserIngredientView>>(`/me/ingredients${toQueryString(params)}`);
}

/** 分组展示需要全量：循环翻页拼接，封顶 5 页 / 500 条（个人原料库的现实上限） */
export const PANTRY_PAGE_SIZE = 100;
export const PANTRY_MAX_PAGES = 5;

export async function getAllMyIngredients(): Promise<UserIngredientView[]> {
  const first = await getMyIngredients({ page: 1, pageSize: PANTRY_PAGE_SIZE });
  const items = [...first.items];
  const pages = Math.min(first.totalPages, PANTRY_MAX_PAGES);
  for (let page = 2; page <= pages; page++) {
    const next = await getMyIngredients({ page, pageSize: PANTRY_PAGE_SIZE });
    items.push(...next.items);
  }
  return items;
}

export function createMyIngredient(body: CreateUserIngredientRequest) {
  return apiFetch<UserIngredientView>('/me/ingredients', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateMyIngredient(id: number, body: UpdateUserIngredientRequest) {
  return apiFetch<UserIngredientView>(`/me/ingredients/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export function deleteMyIngredient(id: number) {
  return apiFetch<{ id: number }>(`/me/ingredients/${id}`, { method: 'DELETE' });
}

/** 公共食材搜索建议（系统预设；中文库对英文关键词常为空——自由文本 customName 是兜底） */
export function getIngredientSuggestions(keyword: string) {
  return apiFetch<Paginated<PublicIngredient>>(
    `/ingredients${toQueryString({ keyword, pageSize: 10 })}`,
  );
}

export function getIngredientCategories() {
  return apiFetch<Paginated<CategoryView>>(
    `/categories${toQueryString({ type: 'ingredient', pageSize: 100 })}`,
  );
}

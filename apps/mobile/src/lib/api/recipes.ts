import { apiFetch } from './client';
import type {
  CreateRecipeRequest,
  Paginated,
  ParseTextResult,
  RecipeListItem,
  RecipeDetail,
  ScaleRequest,
  SpecScaleResult,
  ScaleResult,
} from './types';

// 注意：amount/scaleFactor/percentageValue/ratioValue 等 decimal 字符串字段
// 在这一层保持原样，不做 parseFloat——转换留到使用点（selector / TanStack Query 的 select）。

export interface GetRecipesParams {
  page?: number;
  pageSize?: number;
  keyword?: string;
  categoryId?: number;
  mealSceneId?: number;
  status?: string;
  authorId?: string;
  isPublic?: boolean;
  isFeatured?: boolean;
}

function toQueryString(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value != null) search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export function getRecipes(params: GetRecipesParams = {}) {
  return apiFetch<Paginated<RecipeListItem>>(`/recipes${toQueryString(params)}`);
}

export function getRecipe(id: string) {
  return apiFetch<RecipeDetail>(`/recipes/${id}`);
}

export function scaleRecipe(id: string, body: ScaleRequest) {
  return apiFetch<SpecScaleResult>(`/recipes/${id}/scale`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/** 仅 linear_legacy 配方可用；非 legacy 配方后端已返回 400，客户端不做额外分支判断。 */
export function scaleRecipeByServings(id: string, servings: number) {
  return apiFetch<ScaleResult>(`/recipes/${id}/scale${toQueryString({ servings })}`);
}

/** AI 智能导入：解析粘贴文本为结构化草稿（不入库；限流 5 次/分钟） */
export function parseRecipeText(text: string) {
  return apiFetch<ParseTextResult>('/recipes/parse-text', {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}

export function createRecipe(body: CreateRecipeRequest) {
  return apiFetch<RecipeDetail>('/recipes', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

import { apiFetch } from './client';
import type { CostBreakdown, RecipeCostRequest, ScaleRequest } from './types';

/**
 * 成本估算（契约 §11）。显式构造 body——服务端 forbidNonWhitelisted，
 * 不可整体转发 mutation variables 之类的富对象。
 */
export function getRecipeCost(recipeId: string, scale: ScaleRequest | null) {
  const body: RecipeCostRequest = scale ? { recipeId, scale } : { recipeId };
  return apiFetch<CostBreakdown>('/cooking/cost', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

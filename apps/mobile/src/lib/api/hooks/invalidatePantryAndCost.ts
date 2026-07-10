import type { QueryClient } from '@tanstack/react-query';

/** 原料库变更（尤其单价）会改变所有配方的成本——两个前缀一起失效 */
export function invalidatePantryAndCost(client: QueryClient) {
  client.invalidateQueries({ queryKey: ['pantry'] });
  client.invalidateQueries({ queryKey: ['recipeCost'] });
}

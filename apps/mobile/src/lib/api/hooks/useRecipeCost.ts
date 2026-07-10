import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { getRecipeCost } from '../cost';
import type { ScaleRequest } from '../types';
import { useDebouncedValue } from './useDebouncedValue';

/**
 * 配方成本估算（契约 §11）。
 * - scale 进 queryKey 前 debounce ~400ms：缩放标尺拖动期间不刷成本请求，settle 后跟上。
 * - retry:false：403（PRO 门禁）要立刻进入锁定态，而不是重试三次。
 * - queryKey 以 'recipeCost' 为前缀——pantry mutation 靠它整体失效。
 */
export function useRecipeCost(recipeId: string, scale: ScaleRequest | null, enabled = true) {
  const debouncedScale = useDebouncedValue(scale, 400);

  return useQuery({
    queryKey: ['recipeCost', recipeId, debouncedScale],
    queryFn: () => getRecipeCost(recipeId, debouncedScale),
    enabled: enabled && !!recipeId,
    retry: false,
    placeholderData: keepPreviousData,
  });
}

import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { getIngredientSuggestions } from '../pantry';

/** keyword 由表单侧 debounce 后传入；空串不发请求 */
export function useIngredientSuggestions(keyword: string) {
  return useQuery({
    queryKey: ['ingredientSuggestions', keyword],
    queryFn: () => getIngredientSuggestions(keyword),
    enabled: keyword.trim().length >= 1,
    placeholderData: keepPreviousData,
    select: (data) => data.items,
  });
}

import { useQuery } from '@tanstack/react-query';

import { getRecipes, type GetRecipesParams } from '../recipes';

export function useRecipes(params: GetRecipesParams = {}) {
  return useQuery({
    queryKey: ['recipes', params],
    queryFn: () => getRecipes(params),
  });
}

import { useQuery } from '@tanstack/react-query';

import { getRecipe } from '../recipes';

export function useRecipe(id: string | undefined) {
  return useQuery({
    queryKey: ['recipe', id],
    queryFn: () => getRecipe(id as string),
    enabled: !!id,
  });
}

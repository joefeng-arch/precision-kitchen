import { useQuery } from '@tanstack/react-query';

import { getIngredientCategories } from '../pantry';

export function useIngredientCategories() {
  return useQuery({
    queryKey: ['ingredientCategories'],
    queryFn: getIngredientCategories,
    select: (data) => data.items,
  });
}

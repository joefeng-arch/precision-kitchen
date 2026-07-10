import { useQuery } from '@tanstack/react-query';

import { getAllMyIngredients } from '../pantry';

export function usePantryList() {
  return useQuery({
    queryKey: ['pantry'],
    queryFn: getAllMyIngredients,
  });
}

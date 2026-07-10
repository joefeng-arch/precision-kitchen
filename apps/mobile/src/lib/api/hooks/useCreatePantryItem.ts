import { useMutation } from '@tanstack/react-query';

import { createMyIngredient } from '../pantry';
import { queryClient } from '../queryClient';
import { invalidatePantryAndCost } from './invalidatePantryAndCost';

export function useCreatePantryItem() {
  return useMutation({
    mutationFn: createMyIngredient,
    onSuccess: () => invalidatePantryAndCost(queryClient),
  });
}

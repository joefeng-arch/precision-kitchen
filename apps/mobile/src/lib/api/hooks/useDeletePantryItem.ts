import { useMutation } from '@tanstack/react-query';

import { deleteMyIngredient } from '../pantry';
import { queryClient } from '../queryClient';
import { invalidatePantryAndCost } from './invalidatePantryAndCost';

export function useDeletePantryItem() {
  return useMutation({
    mutationFn: (id: number) => deleteMyIngredient(id),
    onSuccess: () => invalidatePantryAndCost(queryClient),
  });
}

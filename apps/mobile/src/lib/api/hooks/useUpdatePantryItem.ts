import { useMutation } from '@tanstack/react-query';

import { updateMyIngredient } from '../pantry';
import { queryClient } from '../queryClient';
import type { UpdateUserIngredientRequest } from '../types';
import { invalidatePantryAndCost } from './invalidatePantryAndCost';

export function useUpdatePantryItem() {
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: UpdateUserIngredientRequest }) =>
      updateMyIngredient(id, body),
    onSuccess: () => invalidatePantryAndCost(queryClient),
  });
}

import { useMutation } from '@tanstack/react-query';

import { scaleRecipeByServings } from '../recipes';

export function useScaleRecipeByServings() {
  return useMutation({
    mutationFn: ({ id, servings }: { id: string; servings: number }) =>
      scaleRecipeByServings(id, servings),
  });
}

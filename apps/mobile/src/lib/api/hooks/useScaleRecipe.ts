import { useMutation } from '@tanstack/react-query';

import { scaleRecipe } from '../recipes';
import type { ScaleRequest } from '../types';

export function useScaleRecipe() {
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ScaleRequest }) => scaleRecipe(id, body),
  });
}

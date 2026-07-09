import { useMutation } from '@tanstack/react-query';

import { parseRecipeText } from '../recipes';

export function useParseRecipeText() {
  return useMutation({
    mutationFn: (text: string) => parseRecipeText(text),
  });
}

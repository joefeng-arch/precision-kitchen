import { useMutation } from '@tanstack/react-query';

import { createRecipe } from '../recipes';
import { queryClient } from '../queryClient';

export function useCreateRecipe() {
  return useMutation({
    mutationFn: createRecipe,
    // 新配方要出现在 Home 列表；['recipes'] 前缀只失效列表查询，不动详情缓存
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recipes'] }),
  });
}

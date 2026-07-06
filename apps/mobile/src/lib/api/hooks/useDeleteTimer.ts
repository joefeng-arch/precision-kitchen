import { useMutation } from '@tanstack/react-query';

import { deleteTimer } from '../timers';

export function useDeleteTimer() {
  return useMutation({
    mutationFn: (id: string) => deleteTimer(id),
  });
}

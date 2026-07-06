import { useMutation } from '@tanstack/react-query';

import { pauseTimer } from '../timers';

export function usePauseTimer() {
  return useMutation({
    mutationFn: (id: string) => pauseTimer(id),
  });
}

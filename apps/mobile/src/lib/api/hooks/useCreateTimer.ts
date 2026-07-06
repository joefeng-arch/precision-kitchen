import { useMutation } from '@tanstack/react-query';

import { createTimer } from '../timers';
import type { CreateTimerRequest } from '../types';

export function useCreateTimer() {
  return useMutation({
    mutationFn: (body: CreateTimerRequest) => createTimer(body),
  });
}

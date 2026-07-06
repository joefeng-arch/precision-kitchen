import { useMutation } from '@tanstack/react-query';

import { resumeTimer } from '../timers';

export function useResumeTimer() {
  return useMutation({
    mutationFn: (id: string) => resumeTimer(id),
  });
}

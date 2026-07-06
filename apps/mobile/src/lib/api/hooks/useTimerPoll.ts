import { useQuery } from '@tanstack/react-query';

import { getTimer } from '../timers';

/**
 * Polls a running timer for server-authoritative remaining time.
 * staleTime:0 overrides queryClient's global 30s default — without it,
 * refetchInterval's own scheduling can still be suppressed by staleness checks.
 */
export function useTimerPoll(timerId: string | null) {
  return useQuery({
    queryKey: ['timer', timerId],
    queryFn: () => getTimer(timerId as string),
    enabled: !!timerId,
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchInterval: (query) => (query.state.data?.status === 'running' ? 12_000 : false),
  });
}

import { useQuery } from '@tanstack/react-query';

import { getBillingStatus } from '../billing';

export function useBillingStatus() {
  return useQuery({
    queryKey: ['billing', 'status'],
    queryFn: getBillingStatus,
  });
}

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { accountService } from '../services/api';

const KEY = ['provider-credits'];
export const LOW_CREDITS = 50;

/** Live Reoon balance, refreshed every minute. */
export function useProviderCredits() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => accountService.providerCredits().then((r) => r.data.data),
    refetchInterval: 60000,
    staleTime: 20000,
  });
}

/** Call after a verification to pull the new balance straight away. */
export function useRefreshProviderCredits() {
  const qc = useQueryClient();
  return useCallback(() => accountService.providerCredits(true)
    .then((r) => qc.setQueryData(KEY, r.data.data))
    .catch(() => {}), [qc]);
}

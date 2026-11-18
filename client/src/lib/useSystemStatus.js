import { useQuery } from '@tanstack/react-query';
import { accountService } from '../services/api';

/** Shared system status (worker, checkers, whether per-user credits are on). */
export function useSystemStatus() {
  return useQuery({
    queryKey: ['system-status'],
    queryFn: () => accountService.systemStatus().then((r) => r.data.data),
    refetchInterval: 60000,
  });
}

/** True unless the server says per-user credits are switched off. */
export function useUserCreditsEnabled() {
  const { data } = useSystemStatus();
  return data?.userCreditsEnabled !== false;
}

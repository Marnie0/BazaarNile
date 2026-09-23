import { useQuery } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { api, hasAccessToken, subscribeToAccessToken, type User } from '../lib/api';

export const useIsAuthenticated = () => useSyncExternalStore(subscribeToAccessToken, hasAccessToken, () => false);

export function useMe() {
  const authenticated = useIsAuthenticated();
  const me = useQuery({ queryKey: ['me'], queryFn: () => api<{ user: User }>('/auth/me'), enabled: authenticated, retry: false, staleTime: 5 * 60_000 });
  return { ...me, authenticated, user: authenticated ? me.data?.user : undefined };
}

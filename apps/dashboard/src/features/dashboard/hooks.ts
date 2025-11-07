import { useQuery } from '@tanstack/react-query';
import { getDashboardStats } from '../../lib/api/dashboard';
import type { DashboardStats } from '../../types/dashboard';

export function useDashboardStats() {
  return useQuery<DashboardStats, Error>({
    queryKey: ['dashboard', 'stats'],
    queryFn: getDashboardStats,
    staleTime: 60 * 1000,
  });
}

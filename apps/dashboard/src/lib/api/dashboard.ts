import { createJSONClient } from '.';
import type { DashboardStats, DashboardStatsResponse, DashboardStatKey } from '../../types/dashboard';

const client = createJSONClient('/dashboard');

function toMetric(value: DashboardStatsResponse[DashboardStatKey]) {
  if (typeof value === 'number') {
    return { value };
  }
  return {
    value: value.value,
    trend: value.trend ?? null,
  };
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const response = await client<DashboardStatsResponse>('/stats');
  const keys: DashboardStatKey[] = ['totalRecords', 'newRecords', 'errorRecords'];
  return keys.reduce<DashboardStats>((acc, key) => {
    acc[key] = toMetric(response[key]);
    return acc;
  }, {} as DashboardStats);
}

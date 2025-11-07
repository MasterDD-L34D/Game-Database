export type DashboardStatKey = 'totalRecords' | 'newRecords' | 'errorRecords';

export interface DashboardMetric {
  value: number;
  trend?: string | null;
}

export type DashboardStatsResponse = {
  [K in DashboardStatKey]: number | DashboardMetric;
};

export type DashboardStats = {
  [K in DashboardStatKey]: DashboardMetric;
};

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
  const baseStats = keys.reduce<DashboardStats>((acc, key) => {
    acc[key] = toMetric(response[key]);
    return acc;
  }, {} as DashboardStats);

  const taxonomy = response.taxonomy ?? {
    entities: { traits: 0, biomes: 0, species: 0, ecosystems: 0, total: 0 },
    relations: { speciesTraits: 0, speciesBiomes: 0, ecosystemBiomes: 0, ecosystemSpecies: 0, total: 0 },
    quality: { orphanTraits: 0, orphanBiomes: 0, orphanSpecies: 0, orphanEcosystems: 0 },
  };

  return {
    ...baseStats,
    taxonomy,
  };
}

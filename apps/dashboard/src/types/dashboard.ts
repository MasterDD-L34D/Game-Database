export type DashboardStatKey = 'totalRecords' | 'newRecords' | 'errorRecords';

export interface DashboardMetric {
  value: number;
  trend?: string | null;
}

export type DashboardStatsResponse = {
  [K in DashboardStatKey]: number | DashboardMetric;
} & {
  taxonomy?: {
    entities: {
      traits: number;
      biomes: number;
      species: number;
      ecosystems: number;
      total: number;
    };
    relations: {
      speciesTraits: number;
      speciesBiomes: number;
      ecosystemBiomes: number;
      ecosystemSpecies: number;
      total: number;
    };
    quality: {
      orphanTraits: number;
      orphanBiomes: number;
      orphanSpecies: number;
      orphanEcosystems: number;
    };
  };
};

export type DashboardStats = {
  [K in DashboardStatKey]: DashboardMetric;
} & {
  taxonomy: {
    entities: {
      traits: number;
      biomes: number;
      species: number;
      ecosystems: number;
      total: number;
    };
    relations: {
      speciesTraits: number;
      speciesBiomes: number;
      ecosystemBiomes: number;
      ecosystemSpecies: number;
      total: number;
    };
    quality: {
      orphanTraits: number;
      orphanBiomes: number;
      orphanSpecies: number;
      orphanEcosystems: number;
    };
  };
};


import { deleteJSON, fetchJSON, postJSON } from './api';
export type Paged<T> = { items: T[]; page: number; pageSize: number; total: number };

export type TraitDataType = 'BOOLEAN' | 'NUMERIC' | 'CATEGORICAL' | 'TEXT';

export type Trait = {
  id: string;
  slug: string;
  name: string;
  category?: string | null;
  unit?: string | null;
  dataType: TraitDataType;
  description?: string | null;
  allowedValues?: string[] | null;
  rangeMin?: number | null;
  rangeMax?: number | null;
};

export type Biome = {
  id: string;
  slug: string;
  name: string;
  climate?: string | null;
  description?: string | null;
  parentId?: string | null;
};

export type Species = {
  id: string;
  slug: string;
  scientificName: string;
  commonName?: string | null;
  kingdom?: string | null;
  phylum?: string | null;
  class?: string | null;
  order?: string | null;
  family?: string | null;
  genus?: string | null;
  epithet?: string | null;
  status?: string | null;
  description?: string | null;
};

export type Ecosystem = {
  id: string;
  slug: string;
  name: string;
  region?: string | null;
  climate?: string | null;
  description?: string | null;
};

export type SpeciesTraitValue = {
  id: string;
  speciesId: string;
  traitId: string;
  category?: string | null;
  value?: unknown;
  num?: number | null;
  bool?: boolean | null;
  text?: string | null;
  unit?: string | null;
  source?: string | null;
  confidence?: number | null;
  species?: Pick<Species, 'id' | 'slug' | 'scientificName' | 'commonName'> | null;
  trait?: Pick<Trait, 'id' | 'slug' | 'name' | 'dataType' | 'unit'> | null;
};

export type SpeciesBiomeValue = {
  id: string;
  speciesId: string;
  biomeId: string;
  presence: 'resident' | 'migrant' | 'introduced' | 'endemic' | 'unknown';
  abundance?: number | null;
  notes?: string | null;
  species?: Pick<Species, 'id' | 'slug' | 'scientificName' | 'commonName'> | null;
  biome?: Pick<Biome, 'id' | 'slug' | 'name'> | null;
};

export type EcosystemBiomeValue = {
  id: string;
  ecosystemId: string;
  biomeId: string;
  proportion?: number | null;
  notes?: string | null;
  ecosystem?: Pick<Ecosystem, 'id' | 'slug' | 'name'> | null;
  biome?: Pick<Biome, 'id' | 'slug' | 'name'> | null;
};

export type EcosystemSpeciesValue = {
  id: string;
  ecosystemId: string;
  speciesId: string;
  role: 'keystone' | 'dominant' | 'engineer' | 'common' | 'invasive' | 'other';
  abundance?: number | null;
  notes?: string | null;
  ecosystem?: Pick<Ecosystem, 'id' | 'slug' | 'name'> | null;
  species?: Pick<Species, 'id' | 'slug' | 'scientificName' | 'commonName'> | null;
};

export type TraitDetail = Trait & {
  speciesValues: SpeciesTraitValue[];
  relationCounts: {
    speciesValues: number;
  };
};

export type BiomeDetail = Biome & {
  parent?: Pick<Biome, 'id' | 'slug' | 'name'> | null;
  children: Pick<Biome, 'id' | 'slug' | 'name'>[];
  species: SpeciesBiomeValue[];
  ecosystems: EcosystemBiomeValue[];
  relationCounts: {
    children: number;
    species: number;
    ecosystems: number;
  };
};

export type SpeciesDetail = Species & {
  traits: SpeciesTraitValue[];
  biomes: SpeciesBiomeValue[];
  ecosystems: EcosystemSpeciesValue[];
  relationCounts: {
    traits: number;
    biomes: number;
    ecosystems: number;
  };
};

export type EcosystemDetail = Ecosystem & {
  biomes: EcosystemBiomeValue[];
  species: EcosystemSpeciesValue[];
  relationCounts: {
    biomes: number;
    species: number;
  };
};

export const listTraits = (q = '', page=0, pageSize=25) => fetchJSON<Paged<Trait>>(`/traits?q=${encodeURIComponent(q)}&page=${page}&pageSize=${pageSize}`);
export const listBiomes = (q = '', page=0, pageSize=25) => fetchJSON<Paged<Biome>>(`/biomes?q=${encodeURIComponent(q)}&page=${page}&pageSize=${pageSize}`);
export const listSpecies = (q = '', page=0, pageSize=25) => fetchJSON<Paged<Species>>(`/species?q=${encodeURIComponent(q)}&page=${page}&pageSize=${pageSize}`);
export const listEcosystems = (q = '', page=0, pageSize=25) => fetchJSON<Paged<Ecosystem>>(`/ecosystems?q=${encodeURIComponent(q)}&page=${page}&pageSize=${pageSize}`);
export const getTrait = (id: string) => fetchJSON<TraitDetail>(`/traits/${encodeURIComponent(id)}`);
export const getBiome = (id: string) => fetchJSON<BiomeDetail>(`/biomes/${encodeURIComponent(id)}`);
export const getSpecies = (id: string) => fetchJSON<SpeciesDetail>(`/species/${encodeURIComponent(id)}`);
export const getEcosystem = (id: string) => fetchJSON<EcosystemDetail>(`/ecosystems/${encodeURIComponent(id)}`);

export async function listAllTraits(q = '', pageSize = 100) {
  const items: Trait[] = [];
  let page = 0;
  let total = 0;
  do {
    const response = await listTraits(q, page, pageSize);
    items.push(...response.items);
    total = response.total;
    page += 1;
  } while (items.length < total);
  return items;
}

export type TraitInput = Omit<Trait, 'id'>;
export type BiomeInput = Omit<Biome, 'id'>;
export type SpeciesInput = Omit<Species, 'id'>;
export type EcosystemInput = Omit<Ecosystem, 'id'>;

export const createTrait = (body: TraitInput) => postJSON<TraitInput, Trait>('/traits', body);
export const updateTrait = (id: string, body: Partial<TraitInput>) => postJSON<Partial<TraitInput>, Trait>(`/traits/${id}`, body, { method: 'PUT' });
export const deleteTrait = (id: string) => deleteJSON(`/traits/${id}`);

export const createBiome = (body: BiomeInput) => postJSON<BiomeInput, Biome>('/biomes', body);
export const updateBiome = (id: string, body: Partial<BiomeInput>) => postJSON<Partial<BiomeInput>, Biome>(`/biomes/${id}`, body, { method: 'PUT' });
export const deleteBiome = (id: string) => deleteJSON(`/biomes/${id}`);

export const createSpecies = (body: SpeciesInput) => postJSON<SpeciesInput, Species>('/species', body);
export const updateSpecies = (id: string, body: Partial<SpeciesInput>) => postJSON<Partial<SpeciesInput>, Species>(`/species/${id}`, body, { method: 'PUT' });
export const deleteSpecies = (id: string) => deleteJSON(`/species/${id}`);

export const createEcosystem = (body: EcosystemInput) => postJSON<EcosystemInput, Ecosystem>('/ecosystems', body);
export const updateEcosystem = (id: string, body: Partial<EcosystemInput>) => postJSON<Partial<EcosystemInput>, Ecosystem>(`/ecosystems/${id}`, body, { method: 'PUT' });
export const deleteEcosystem = (id: string) => deleteJSON(`/ecosystems/${id}`);


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

export type VersionStatus = 'draft' | 'released' | 'retired';

export type TaxonomyVersion = {
  id: string;
  tag: string;
  status: VersionStatus;
  description?: string | null;
  releasedAt?: string | null;
  releasedBy?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type VersionCounts = { trait: number; biome: number; species: number; ecosystem: number };

export const listTraits = (q = '', page = 0, pageSize = 25, _sort = '', versionId = '') =>
  fetchJSON<Paged<Trait> & { _version?: string }>(
    `/traits?q=${encodeURIComponent(q)}&page=${page}&pageSize=${pageSize}` +
      (versionId ? `&versionId=${encodeURIComponent(versionId)}` : ''),
  );
export const listBiomes = (q = '', page=0, pageSize=25) => fetchJSON<Paged<Biome>>(`/biomes?q=${encodeURIComponent(q)}&page=${page}&pageSize=${pageSize}`);
export const listSpecies = (q = '', page=0, pageSize=25) => fetchJSON<Paged<Species>>(`/species?q=${encodeURIComponent(q)}&page=${page}&pageSize=${pageSize}`);
export const listEcosystems = (q = '', page=0, pageSize=25) => fetchJSON<Paged<Ecosystem>>(`/ecosystems?q=${encodeURIComponent(q)}&page=${page}&pageSize=${pageSize}`);
export const getTrait = (id: string) => fetchJSON<Trait>(`/traits/${id}`);
export const getBiome = (id: string) => fetchJSON<Biome>(`/biomes/${id}`);
export const getSpecies = (id: string) => fetchJSON<Species>(`/species/${id}`);
export const getEcosystem = (id: string) => fetchJSON<Ecosystem>(`/ecosystems/${id}`);

async function listAllWithPager<T>(fetchPage: (page: number, pageSize: number) => Promise<Paged<T>>, pageSize = 100) {
  const items: T[] = [];
  let page = 0;
  let total = 0;
  do {
    const response = await fetchPage(page, pageSize);
    items.push(...response.items);
    total = response.total;
    page += 1;
  } while (items.length < total);
  return items;
}

export async function listAllTraits(q = '', pageSize = 100) {
  return listAllWithPager((page, localPageSize) => listTraits(q, page, localPageSize), pageSize);
}

export async function listAllBiomes(q = '', pageSize = 100) {
  return listAllWithPager((page, localPageSize) => listBiomes(q, page, localPageSize), pageSize);
}

export async function listAllSpecies(q = '', pageSize = 100) {
  return listAllWithPager((page, localPageSize) => listSpecies(q, page, localPageSize), pageSize);
}

export async function listAllEcosystems(q = '', pageSize = 100) {
  return listAllWithPager((page, localPageSize) => listEcosystems(q, page, localPageSize), pageSize);
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

export const listTaxonomyVersions = (includeRetired = false) =>
  fetchJSON<{ versions: TaxonomyVersion[] }>(`/taxonomy/versions?includeRetired=${includeRetired ? 'true' : 'false'}`);

export const getTaxonomyVersion = (tag: string) =>
  fetchJSON<{ version: TaxonomyVersion; counts: VersionCounts }>(`/taxonomy/versions/${encodeURIComponent(tag)}`);

export const createTaxonomyVersion = (body: { tag: string; description?: string }) =>
  postJSON<{ tag: string; description?: string }, { version: TaxonomyVersion }>('/taxonomy/versions', body);

export const releaseTaxonomyVersion = (tag: string) =>
  postJSON<Record<string, never>, { version: TaxonomyVersion; counts: VersionCounts }>(
    `/taxonomy/versions/${encodeURIComponent(tag)}/release`,
    {},
  );

export const retireTaxonomyVersion = (tag: string) =>
  postJSON<Record<string, never>, { version: TaxonomyVersion }>(
    `/taxonomy/versions/${encodeURIComponent(tag)}/retire`,
    {},
  );

export const deleteTaxonomyVersion = (tag: string) => deleteJSON(`/taxonomy/versions/${encodeURIComponent(tag)}`);

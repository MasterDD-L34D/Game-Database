import { deleteJSON, fetchJSON, postJSON } from './api';

export type SpeciesTraitRelation = {
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
};

export type SpeciesBiomeRelation = {
  id: string;
  speciesId: string;
  biomeId: string;
  presence: 'resident' | 'migrant' | 'introduced' | 'endemic' | 'unknown';
  abundance?: number | null;
  notes?: string | null;
};

export type EcosystemBiomeRelation = {
  id: string;
  ecosystemId: string;
  biomeId: string;
  proportion?: number | null;
  notes?: string | null;
};

export type EcosystemSpeciesRelation = {
  id: string;
  ecosystemId: string;
  speciesId: string;
  role: 'keystone' | 'dominant' | 'engineer' | 'common' | 'invasive' | 'other';
  abundance?: number | null;
  notes?: string | null;
};

type Paged<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
};

type PaginationPayload = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

type PagedResponse<T> = {
  items: T[];
  pagination: PaginationPayload;
};

function toQueryString(params: Record<string, string | number | null | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    query.set(key, String(value));
  });
  return query.toString();
}

function toPagedResult<T>(response: PagedResponse<T>): Paged<T> {
  return {
    items: response.items,
    page: response.pagination.page,
    pageSize: response.pagination.pageSize,
    total: response.pagination.total,
  };
}

async function fetchPagedRelations<T>(path: string, params: Record<string, string | number | null | undefined>) {
  const query = toQueryString(params);
  const targetPath = query ? `${path}?${query}` : path;
  const response = await fetchJSON<PagedResponse<T>>(targetPath);
  return toPagedResult(response);
}

async function fetchAllRelations<T>(path: string, filters: Record<string, string | number | null | undefined>) {
  const pageSize = 100;
  const items: T[] = [];
  let page = 0;
  let total = 0;
  do {
    const response = await fetchPagedRelations<T>(path, { ...filters, page, pageSize });
    items.push(...response.items);
    total = response.total;
    page += 1;
  } while (items.length < total);
  return items;
}

export async function listSpeciesTraits(q = '', page = 0, pageSize = 25, sort = '') {
  return fetchPagedRelations<SpeciesTraitRelation>('/species-traits', { q, page, pageSize, sort });
}

export async function getSpeciesTraits(filters: { speciesId?: string; traitId?: string; category?: string } = {}) {
  return fetchAllRelations<SpeciesTraitRelation>('/species-traits', filters);
}

export async function listSpeciesBiomes(q = '', page = 0, pageSize = 25, sort = '') {
  return fetchPagedRelations<SpeciesBiomeRelation>('/species-biomes', { q, page, pageSize, sort });
}

export async function getSpeciesBiomes(filters: { speciesId?: string; biomeId?: string; presence?: string } = {}) {
  return fetchAllRelations<SpeciesBiomeRelation>('/species-biomes', filters);
}

export async function listEcosystemBiomes(q = '', page = 0, pageSize = 25, sort = '') {
  return fetchPagedRelations<EcosystemBiomeRelation>('/ecosystem-biomes', { q, page, pageSize, sort });
}

export async function getEcosystemBiomes(filters: { ecosystemId?: string; biomeId?: string } = {}) {
  return fetchAllRelations<EcosystemBiomeRelation>('/ecosystem-biomes', filters);
}

export async function listEcosystemSpecies(q = '', page = 0, pageSize = 25, sort = '') {
  return fetchPagedRelations<EcosystemSpeciesRelation>('/ecosystem-species', { q, page, pageSize, sort });
}

export async function getEcosystemSpecies(filters: { ecosystemId?: string; speciesId?: string; role?: string } = {}) {
  return fetchAllRelations<EcosystemSpeciesRelation>('/ecosystem-species', filters);
}

export const createSpeciesTrait = (body: Omit<SpeciesTraitRelation, 'id'>) =>
  postJSON<Omit<SpeciesTraitRelation, 'id'>, SpeciesTraitRelation>('/species-traits', body);
export const updateSpeciesTrait = (id: string, body: Partial<Omit<SpeciesTraitRelation, 'id'>>) =>
  postJSON<Partial<Omit<SpeciesTraitRelation, 'id'>>, SpeciesTraitRelation>(`/species-traits/${id}`, body, {
    method: 'PATCH',
  });
export const deleteSpeciesTrait = (id: string) => deleteJSON(`/species-traits/${id}`);

export const createSpeciesBiome = (body: Omit<SpeciesBiomeRelation, 'id'>) =>
  postJSON<Omit<SpeciesBiomeRelation, 'id'>, SpeciesBiomeRelation>('/species-biomes', body);
export const updateSpeciesBiome = (id: string, body: Partial<Omit<SpeciesBiomeRelation, 'id'>>) =>
  postJSON<Partial<Omit<SpeciesBiomeRelation, 'id'>>, SpeciesBiomeRelation>(`/species-biomes/${id}`, body, {
    method: 'PATCH',
  });
export const deleteSpeciesBiome = (id: string) => deleteJSON(`/species-biomes/${id}`);

export const createEcosystemBiome = (body: Omit<EcosystemBiomeRelation, 'id'>) =>
  postJSON<Omit<EcosystemBiomeRelation, 'id'>, EcosystemBiomeRelation>('/ecosystem-biomes', body);
export const updateEcosystemBiome = (id: string, body: Partial<Omit<EcosystemBiomeRelation, 'id'>>) =>
  postJSON<Partial<Omit<EcosystemBiomeRelation, 'id'>>, EcosystemBiomeRelation>(`/ecosystem-biomes/${id}`, body, {
    method: 'PATCH',
  });
export const deleteEcosystemBiome = (id: string) => deleteJSON(`/ecosystem-biomes/${id}`);

export const createEcosystemSpecies = (body: Omit<EcosystemSpeciesRelation, 'id'>) =>
  postJSON<Omit<EcosystemSpeciesRelation, 'id'>, EcosystemSpeciesRelation>('/ecosystem-species', body);
export const updateEcosystemSpecies = (id: string, body: Partial<Omit<EcosystemSpeciesRelation, 'id'>>) =>
  postJSON<Partial<Omit<EcosystemSpeciesRelation, 'id'>>, EcosystemSpeciesRelation>(`/ecosystem-species/${id}`, body, {
    method: 'PATCH',
  });
export const deleteEcosystemSpecies = (id: string) => deleteJSON(`/ecosystem-species/${id}`);

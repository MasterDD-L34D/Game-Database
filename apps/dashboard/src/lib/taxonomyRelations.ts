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

function paginateLocally<T>(items: T[], page = 0, pageSize = 25, q = '', fields: (keyof T)[] = []): Paged<T> {
  const query = q.trim().toLowerCase();
  const filtered = !query
    ? items
    : items.filter(item =>
        fields.some(field => {
          const value = item[field];
          return value !== undefined && value !== null && String(value).toLowerCase().includes(query);
        }),
      );
  const start = page * pageSize;
  return {
    items: filtered.slice(start, start + pageSize),
    page,
    pageSize,
    total: filtered.length,
  };
}

export async function listSpeciesTraits(q = '', page = 0, pageSize = 25) {
  const items = await fetchJSON<SpeciesTraitRelation[]>('/species-traits');
  return paginateLocally(items, page, pageSize, q, [
    'speciesId',
    'traitId',
    'category',
    'text',
    'unit',
    'source',
  ]);
}

export async function listSpeciesBiomes(q = '', page = 0, pageSize = 25) {
  const items = await fetchJSON<SpeciesBiomeRelation[]>('/species-biomes');
  return paginateLocally(items, page, pageSize, q, ['speciesId', 'biomeId', 'presence', 'notes']);
}

export async function listEcosystemBiomes(q = '', page = 0, pageSize = 25) {
  const items = await fetchJSON<EcosystemBiomeRelation[]>('/ecosystem-biomes');
  return paginateLocally(items, page, pageSize, q, ['ecosystemId', 'biomeId', 'notes']);
}

export async function listEcosystemSpecies(q = '', page = 0, pageSize = 25) {
  const items = await fetchJSON<EcosystemSpeciesRelation[]>('/ecosystem-species');
  return paginateLocally(items, page, pageSize, q, ['ecosystemId', 'speciesId', 'role', 'notes']);
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

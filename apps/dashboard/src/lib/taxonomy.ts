
import { deleteJSON, fetchJSON, postJSON } from './api';
export type Paged<T> = { items: T[]; page: number; pageSize: number; total: number };
export type Trait = { id: string; slug: string; name: string; category?: string; unit?: string; dataType: string; description?: string };
export type Biome = { id: string; slug: string; name: string; climate?: string; description?: string; parentId?: string };
export type Species = { id: string; slug: string; scientificName: string; commonName?: string; family?: string; genus?: string; status?: string; description?: string };
export type Ecosystem = { id: string; slug: string; name: string; region?: string; climate?: string; description?: string };
export const listTraits = (q = '', page=0, pageSize=25) => fetchJSON<Paged<Trait>>(`/traits?q=${encodeURIComponent(q)}&page=${page}&pageSize=${pageSize}`);
export const listBiomes = (q = '', page=0, pageSize=25) => fetchJSON<Paged<Biome>>(`/biomes?q=${encodeURIComponent(q)}&page=${page}&pageSize=${pageSize}`);
export const listSpecies = (q = '', page=0, pageSize=25) => fetchJSON<Paged<Species>>(`/species?q=${encodeURIComponent(q)}&page=${page}&pageSize=${pageSize}`);
export const listEcosystems = (q = '', page=0, pageSize=25) => fetchJSON<Paged<Ecosystem>>(`/ecosystems?q=${encodeURIComponent(q)}&page=${page}&pageSize=${pageSize}`);

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

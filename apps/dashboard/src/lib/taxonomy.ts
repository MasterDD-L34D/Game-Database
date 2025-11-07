
import { fetchJSON } from './api';
export type Paged<T> = { items: T[]; page: number; pageSize: number; total: number };
export type Trait = { id: string; slug: string; name: string; category?: string; unit?: string; dataType: string; description?: string };
export type Biome = { id: string; slug: string; name: string; climate?: string; description?: string; parentId?: string };
export type Species = { id: string; slug: string; scientificName: string; commonName?: string; family?: string; genus?: string; status?: string; description?: string };
export type Ecosystem = { id: string; slug: string; name: string; region?: string; climate?: string; description?: string };
export const listTraits = (q = '', page=0, pageSize=25) => fetchJSON<Paged<Trait>>(`/traits?q=${encodeURIComponent(q)}&page=${page}&pageSize=${pageSize}`);
export const listBiomes = (q = '', page=0, pageSize=25) => fetchJSON<Paged<Biome>>(`/biomes?q=${encodeURIComponent(q)}&page=${page}&pageSize=${pageSize}`);
export const listSpecies = (q = '', page=0, pageSize=25) => fetchJSON<Paged<Species>>(`/species?q=${encodeURIComponent(q)}&page=${page}&pageSize=${pageSize}`);
export const listEcosystems = (q = '', page=0, pageSize=25) => fetchJSON<Paged<Ecosystem>>(`/ecosystems?q=${encodeURIComponent(q)}&page=${page}&pageSize=${pageSize}`);

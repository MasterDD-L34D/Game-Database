
import { deleteJSON, fetchJSON, postJSON } from './api';
import type { RecordRow, Stile, Pattern, Peso, Curvatura } from '../types/record';
export type ListResponse<T> = { items: T[]; page: number; pageSize: number; total: number };
export function listRecords(params: { q?: string; page?: number; pageSize?: number; sort?: string; stile?: Stile; pattern?: Pattern; peso?: Peso; curvatura?: Curvatura; }) {
  const usp = new URLSearchParams();
  if (params.q) usp.set('q', params.q);
  if (params.page != null) usp.set('page', String(params.page));
  if (params.pageSize != null) usp.set('pageSize', String(params.pageSize));
  if (params.sort) usp.set('sort', params.sort);
  if (params.stile) usp.set('stile', params.stile);
  if (params.pattern) usp.set('pattern', params.pattern);
  if (params.peso) usp.set('peso', params.peso);
  if (params.curvatura) usp.set('curvatura', params.curvatura);
  return fetchJSON<ListResponse<RecordRow>>(`/records?${usp.toString()}`);
}
export function createRecord(body: Omit<RecordRow, 'id'|'createdAt'|'updatedAt'>) { return postJSON<typeof body, RecordRow>('/records', body); }
export function getRecord(id: string) {
  return fetchJSON<RecordRow>(`/records/${id}`);
}
export function updateRecord(id: string, patch: Partial<RecordRow>) {
  return fetchJSON<RecordRow>(`/records/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}
export function deleteRecord(id: string): Promise<void> {
  return deleteJSON(`/records/${id}`);
}

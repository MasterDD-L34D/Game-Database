
import { deleteJSON, fetchJSON, postJSON } from './api';
import type { RecordRow, Stile, Pattern, Peso, Curvatura } from '../types/record';

export type ListResponse<T> = { items: T[]; page: number; pageSize: number; total: number };

export type ListRecordsParams = {
  q?: string;
  page: number;
  pageSize: number;
  sort?: string;
  stile?: Stile;
  pattern?: Pattern;
  peso?: Peso;
  curvatura?: Curvatura;
};

type QueryParamKeys = 'q' | 'page' | 'pageSize' | 'sort' | 'stile' | 'pattern' | 'peso' | 'curvatura';
type ServerQueryParams = Partial<Pick<ListRecordsParams, QueryParamKeys>>;

export const recordsListBaseKey = ['records', 'list'] as const;

export function recordsListQueryKey(params: ListRecordsParams) {
  return [...recordsListBaseKey, params] as const;
}

export function buildServerQuery(params: ServerQueryParams) {
  const usp = new URLSearchParams();
  if (params.q) usp.set('q', params.q);
  if (params.page !== undefined) usp.set('page', String(params.page));
  if (params.pageSize !== undefined) usp.set('pageSize', String(params.pageSize));
  if (params.sort) usp.set('sort', params.sort);
  (['stile', 'pattern', 'peso', 'curvatura'] as const).forEach((key) => {
    const value = params[key];
    if (value) usp.set(key, value);
  });
  return usp.toString();
}

export function listRecords(params: ListRecordsParams) {
  return fetchJSON<ListResponse<RecordRow>>(`/records?${buildServerQuery(params)}`);
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

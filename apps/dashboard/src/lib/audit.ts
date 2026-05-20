import { fetchJSON, postJSON } from './api';

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE';

export interface AuditEntry {
  id: string;
  entity: string;
  entityId: string;
  action: AuditAction;
  user: string | null;
  payload: unknown;
  createdAt: string;
}

export interface AuditQuery {
  entity?: string;
  entityId?: string;
  action?: AuditAction;
  user?: string;
  /** ISO8601 date string lower bound (gte createdAt) */
  since?: string;
  /** ISO8601 date string upper bound (lte createdAt) */
  until?: string;
  page?: number;
  pageSize?: number;
}

export interface AuditPage {
  items: AuditEntry[];
  page: number;
  pageSize: number;
  total: number;
}

export async function listAudit(query: AuditQuery = {}): Promise<AuditPage> {
  const params = new URLSearchParams();
  if (query.entity) params.set('entity', query.entity);
  if (query.entityId) params.set('entityId', query.entityId);
  if (query.action) params.set('action', query.action);
  if (query.user) params.set('user', query.user);
  if (query.since) params.set('since', query.since);
  if (query.until) params.set('until', query.until);
  if (query.page !== undefined) params.set('page', String(query.page));
  if (query.pageSize !== undefined) params.set('pageSize', String(query.pageSize));
  const qs = params.toString();
  return fetchJSON<AuditPage>(`/audit${qs ? `?${qs}` : ''}`);
}

export interface RevertResponse {
  success: boolean;
  id: string;
  entity: string;
  revertedFrom: string;
}

export async function revertAudit(logId: string): Promise<RevertResponse> {
  return postJSON<Record<string, never>, RevertResponse>(`/audit/${encodeURIComponent(logId)}/revert`, {});
}


import { NetworkError } from './errors';

const BASE = import.meta.env.VITE_API_BASE_URL || '/api';
const USER = import.meta.env.VITE_API_USER as string | undefined;

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

function authHeaders() {
  const roles = import.meta.env.VITE_API_ROLES as string | undefined;
  return {
    ...(USER ? { 'X-User': USER } : {}),
    ...(roles ? { 'X-Roles': roles } : {}),
  } as Record<string, string>;
}

async function toApiError(res: Response): Promise<ApiError> {
  let code: string | undefined;
  let message = `HTTP ${res.status}`;
  try {
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const body = (await res.json()) as { code?: string; message?: string };
      if (body && typeof body === 'object') {
        if (body.code) code = body.code;
        if (body.message) message = body.message;
      }
    }
  } catch {
    // non-JSON or empty body -> keep the generic message
  }
  return new ApiError(res.status, message, code);
}

async function executeFetch(path: string, init?: RequestInit) {
  try {
    return await fetch(`${BASE}${path}`, init);
  } catch (error) {
    if (error instanceof TypeError) {
      throw new NetworkError('Unable to reach the API server.', { cause: error });
    }
    throw error;
  }
}

export async function fetchJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await executeFetch(path, {
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...(init?.headers || {}) },
    ...init,
  });
  if (!res.ok) throw await toApiError(res);
  return res.json() as Promise<T>;
}

export async function postJSON<TReq, TRes = unknown>(path: string, body: TReq, init?: RequestInit): Promise<TRes> {
  const method = init?.method ?? 'POST';
  const res = await executeFetch(path, {
    ...init,
    method,
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...(init?.headers || {}) },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await toApiError(res);
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? await res.json() : (undefined as unknown as TRes);
}

export async function deleteJSON(path: string, init?: RequestInit): Promise<void> {
  const res = await executeFetch(path, {
    ...init,
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...(init?.headers || {}) },
  });
  if (!res.ok) throw await toApiError(res);
}

function normalizeBasePath(basePath: string) {
  if (!basePath) return '';
  const trimmed = basePath.replace(/\/+$/, '');
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function normalizeSuffix(path: string) {
  if (!path) return '';
  return path.startsWith('/') ? path : `/${path}`;
}

export function createJSONClient(basePath = '') {
  const normalizedBase = normalizeBasePath(basePath);
  return async function jsonClient<T>(path = '', init?: RequestInit): Promise<T> {
    const suffix = normalizeSuffix(path);
    const finalPath = `${normalizedBase}${suffix}` || normalizedBase || suffix;
    return fetchJSON<T>(finalPath || '/', init);
  };
}

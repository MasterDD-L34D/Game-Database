
const BASE = import.meta.env.VITE_API_BASE_URL || '/api';
const TOKEN = import.meta.env.VITE_API_TOKEN as string | undefined;
const USER = import.meta.env.VITE_API_USER as string | undefined;

function authHeaders() {
  return {
    ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
    ...(USER ? { 'X-User': USER } : {}),
  } as Record<string, string>;
}

export async function fetchJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...(init?.headers || {}) },
    ...init,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export async function postJSON<TReq, TRes = unknown>(path: string, body: TReq, init?: RequestInit): Promise<TRes> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(), ...(init?.headers || {}) },
    body: JSON.stringify(body),
    ...init,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? await res.json() : (undefined as unknown as TRes);
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

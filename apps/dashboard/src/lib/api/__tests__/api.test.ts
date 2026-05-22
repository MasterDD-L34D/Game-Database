import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchJSON, ApiError } from '../index';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.unstubAllEnvs();
});

function mockFetchOnce(status: number, body: unknown) {
  globalThis.fetch = vi.fn(async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    }) as Response,
  ) as unknown as typeof fetch;
}

describe('api client', () => {
  it('sends X-Roles when VITE_API_ROLES is set', async () => {
    vi.stubEnv('VITE_API_ROLES', 'admin');
    const spy = vi.fn(async () => new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }) as Response);
    globalThis.fetch = spy as unknown as typeof fetch;
    await fetchJSON('/ping');
    const init = spy.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)['X-Roles']).toBe('admin');
  });

  it('omits X-Roles when VITE_API_ROLES is unset', async () => {
    vi.stubEnv('VITE_API_ROLES', '');
    const spy = vi.fn(async () => new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }) as Response);
    globalThis.fetch = spy as unknown as typeof fetch;
    await fetchJSON('/ping');
    const init = spy.mock.calls[0][1] as RequestInit;
    expect('X-Roles' in (init.headers as Record<string, string>)).toBe(false);
  });

  it('throws ApiError carrying status + code from the error body', async () => {
    mockFetchOnce(409, { code: 'DRAFT_EXISTS', message: 'A draft already exists' });
    const rejected = fetchJSON('/x');
    await expect(rejected).rejects.toBeInstanceOf(ApiError);
    await expect(rejected).rejects.toMatchObject({ status: 409, code: 'DRAFT_EXISTS' });
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { NetworkError } from './errors';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('api helpers', () => {
  it('wraps network failures in a NetworkError when fetching JSON', async () => {
    const networkFailure = new TypeError('Failed to fetch');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(networkFailure));

    const { fetchJSON } = await import('./index');

    const request = fetchJSON('/records');

    await expect(request).rejects.toBeInstanceOf(NetworkError);
    await expect(request).rejects.toMatchObject({
      message: 'Unable to reach the API server.',
      cause: networkFailure,
    });
  });
});

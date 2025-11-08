import { afterEach, describe, expect, it, vi } from 'vitest';

const USER = 'auditor@example.com';

function createFetchMock() {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue(undefined),
    headers: { get: vi.fn().mockReturnValue('application/json') },
  } as unknown as Response);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('records API helpers', () => {
  it('propagates the user header when deleting a record', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_API_USER', USER);
    const fetchMock = createFetchMock();
    vi.stubGlobal('fetch', fetchMock);

    const { deleteRecord } = await import('./records');

    await deleteRecord('42');

    expect(fetchMock).toHaveBeenCalledWith('/api/records/42', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'X-User': USER,
      },
    });
  });

  it('propagates the user header when creating a record', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_API_USER', USER);
    const fetchMock = createFetchMock();
    vi.stubGlobal('fetch', fetchMock);

    const { createRecord } = await import('./records');

    await createRecord({ nome: 'Test', stato: 'Attivo' });

    expect(fetchMock).toHaveBeenCalledWith('/api/records', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User': USER,
      },
      body: JSON.stringify({ nome: 'Test', stato: 'Attivo' }),
    });
  });

  it('propagates the user header when updating a record', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_API_USER', USER);
    const fetchMock = createFetchMock();
    vi.stubGlobal('fetch', fetchMock);

    const { updateRecord } = await import('./records');

    await updateRecord('1', { nome: 'Updated' });

    expect(fetchMock).toHaveBeenCalledWith('/api/records/1', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-User': USER,
      },
      body: JSON.stringify({ nome: 'Updated' }),
    });
  });
});

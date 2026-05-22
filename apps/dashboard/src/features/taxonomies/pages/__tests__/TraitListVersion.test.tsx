import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, createMemoryRouter } from '../../../../testUtils/renderWithProviders';
import TraitListPage from '../TraitListPage';

const mocks = vi.hoisted(() => ({
  listTraits: vi.fn(),
  createTrait: vi.fn(),
  updateTrait: vi.fn(),
  deleteTrait: vi.fn(),
  listTaxonomyVersions: vi.fn(),
}));
vi.mock('../../../../lib/taxonomy', () => mocks);

function renderAt(path: string) {
  const router = createMemoryRouter([{ path: '/traits', element: <TraitListPage /> }], { initialEntries: [path] });
  return renderWithProviders(<div />, { router });
}

describe('TraitListPage version picker', () => {
  beforeEach(() => {
    mocks.listTraits.mockReset();
    mocks.listTaxonomyVersions.mockReset();
  });

  it('passes versionId to listTraits and hides create when a version is active', async () => {
    mocks.listTaxonomyVersions.mockResolvedValue({ versions: [{ id: '2', tag: 'v1.0.0', status: 'released', description: null, releasedAt: '2026-01-01T00:00:00.000Z', releasedBy: 'a', createdAt: '', updatedAt: '' }] });
    mocks.listTraits.mockResolvedValue({ items: [], page: 0, pageSize: 20, total: 0, _version: 'v1.0.0' });
    renderAt('/traits?versionId=v1.0.0');
    await waitFor(() => expect(mocks.listTraits).toHaveBeenCalledWith('', 0, 20, '', 'v1.0.0'));
    expect(screen.queryByRole('button', { name: /nuovo trait/i })).toBeNull();
    expect(screen.getByText(/sola lettura/i)).toBeTruthy();
  });

  it('keeps the live path (no versionId) and shows create', async () => {
    mocks.listTaxonomyVersions.mockResolvedValue({ versions: [] });
    mocks.listTraits.mockResolvedValue({ items: [], page: 0, pageSize: 20, total: 0 });
    renderAt('/traits');
    await waitFor(() => expect(mocks.listTraits).toHaveBeenCalledWith('', 0, 20, ''));
    expect(screen.getByRole('button', { name: /nuovo trait/i })).toBeTruthy();
  });
});

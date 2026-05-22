import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../../testUtils/renderWithProviders';
import TaxonomyVersionPage from '../TaxonomyVersionPage';

const mocks = vi.hoisted(() => ({
  listTaxonomyVersions: vi.fn(),
  createTaxonomyVersion: vi.fn(),
  releaseTaxonomyVersion: vi.fn(),
  retireTaxonomyVersion: vi.fn(),
  deleteTaxonomyVersion: vi.fn(),
  getTaxonomyVersion: vi.fn(),
}));
vi.mock('../../../../lib/taxonomy', () => mocks);

const draft = { id: '1', tag: 'v2.0.0', status: 'draft', description: null, releasedAt: null, releasedBy: null, createdAt: '', updatedAt: '' };

describe('TaxonomyVersionPage', () => {
  it('lists versions and creates a draft', async () => {
    const user = userEvent.setup();
    mocks.listTaxonomyVersions.mockResolvedValue({ versions: [] });
    mocks.createTaxonomyVersion.mockResolvedValue({ version: draft });
    renderWithProviders(<TaxonomyVersionPage />);
    await user.click(await screen.findByRole('button', { name: /nuova versione/i }));
    await user.type(screen.getByLabelText(/tag/i), 'v2.0.0');
    await user.click(screen.getByRole('button', { name: /crea bozza/i }));
    await waitFor(() => expect(mocks.createTaxonomyVersion).toHaveBeenCalledWith({ tag: 'v2.0.0' }));
  });

  it('releases a draft through the confirm dialog', async () => {
    const user = userEvent.setup();
    mocks.listTaxonomyVersions.mockResolvedValue({ versions: [draft] });
    mocks.releaseTaxonomyVersion.mockResolvedValue({ version: { ...draft, status: 'released' }, counts: { trait: 0, biome: 0, species: 0, ecosystem: 0 } });
    renderWithProviders(<TaxonomyVersionPage />);
    await user.click(await screen.findByRole('button', { name: /rilascia/i }));
    await user.click(await screen.findByRole('button', { name: /^conferma$/i }));
    await waitFor(() => expect(mocks.releaseTaxonomyVersion).toHaveBeenCalledWith('v2.0.0'));
  });

  it('shows an explicit error state when the version list fails to load', async () => {
    mocks.listTaxonomyVersions.mockRejectedValue(new Error('network down'));
    renderWithProviders(<TaxonomyVersionPage />);
    expect(await screen.findByText(/impossibile caricare le versioni/i)).toBeTruthy();
    // not the "no versions" empty-state
    expect(screen.queryByText(/nessuna versione presente/i)).toBeNull();
  });
});

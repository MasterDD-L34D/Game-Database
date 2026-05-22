import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../../testUtils/renderWithProviders';
import VersionDetailDialog from '../VersionDetailDialog';

const getTaxonomyVersion = vi.hoisted(() => vi.fn());
vi.mock('../../../../lib/taxonomy', () => ({ getTaxonomyVersion }));

describe('VersionDetailDialog', () => {
  it('fetches the version and renders the counts', async () => {
    getTaxonomyVersion.mockResolvedValue({
      version: { id: '2', tag: 'v1.0.0', status: 'released', description: 'base', releasedAt: '2026-01-01T00:00:00.000Z', releasedBy: 'admin', createdAt: '', updatedAt: '' },
      counts: { trait: 392, biome: 10, species: 50, ecosystem: 5 },
    });
    renderWithProviders(<VersionDetailDialog open tag="v1.0.0" onClose={() => {}} />);
    expect(await screen.findByText('392')).toBeTruthy();
    expect(getTaxonomyVersion).toHaveBeenCalledWith('v1.0.0');
  });
});

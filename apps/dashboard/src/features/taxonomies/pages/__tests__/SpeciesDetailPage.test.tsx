import { screen } from '@testing-library/react';
import { vi } from 'vitest';
import SpeciesDetailPage from '../SpeciesDetailPage';
import { renderWithProviders } from '../../../../testUtils/renderWithProviders';

const taxonomyMocks = vi.hoisted(() => ({
  getSpecies: vi.fn(async () => ({
    id: 'species-1',
    slug: 'falco-pellegrino',
    scientificName: 'Falco peregrinus',
    commonName: 'Falco pellegrino',
    status: 'LC',
    family: 'Falconidae',
    genus: 'Falco',
    description: 'Rapace ad alta velocita.',
    traits: [
      {
        id: 'st-1',
        speciesId: 'species-1',
        traitId: 'trait-1',
        category: 'baseline',
        text: 'alto',
        trait: {
          id: 'trait-1',
          slug: 'velocita-picchiata',
          name: 'Velocita di picchiata',
          dataType: 'TEXT',
        },
      },
    ],
    biomes: [
      {
        id: 'sb-1',
        speciesId: 'species-1',
        biomeId: 'biome-1',
        presence: 'resident',
        biome: { id: 'biome-1', slug: 'montane-coniferous-forest', name: 'Foresta montana di conifere' },
      },
    ],
    ecosystems: [
      {
        id: 'es-1',
        ecosystemId: 'eco-1',
        speciesId: 'species-1',
        role: 'keystone',
        ecosystem: { id: 'eco-1', slug: 'catena-alpina', name: 'Catena alpina' },
      },
    ],
    relationCounts: {
      traits: 1,
      biomes: 1,
      ecosystems: 1,
    },
  })),
}));

vi.mock('../../../../lib/taxonomy', () => ({
  getSpecies: taxonomyMocks.getSpecies,
}));

describe('SpeciesDetailPage', () => {
  it('renders species details and related navigation links', async () => {
    renderWithProviders(<SpeciesDetailPage />, {
      router: {
        initialEntries: ['/species/falco-pellegrino'],
        routes: [{ path: '/species/:speciesId', element: <SpeciesDetailPage /> }],
      },
    });

    await screen.findByRole('heading', { name: 'Falco peregrinus' });
    expect(screen.getAllByText('Falco pellegrino').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Velocita di picchiata' })).toHaveAttribute('href', '/traits/velocita-picchiata');
    expect(screen.getByRole('link', { name: 'Foresta montana di conifere' })).toHaveAttribute('href', '/biomes/montane-coniferous-forest');
    expect(screen.getByRole('link', { name: 'Catena alpina' })).toHaveAttribute('href', '/ecosystems/catena-alpina');
  });
});

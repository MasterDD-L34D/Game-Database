import { describe, expect, it, beforeEach, vi, type Mock } from 'vitest';
import { screen } from '@testing-library/react';
import { type ReactElement } from 'react';
import { renderWithProviders } from '../../../../testUtils/renderWithProviders';
import TraitDetailsPage from '../TraitDetailsPage';
import BiomeDetailsPage from '../BiomeDetailsPage';
import SpeciesDetailsPage from '../SpeciesDetailsPage';
import EcosystemDetailsPage from '../EcosystemDetailsPage';
import * as taxonomyApi from '../../../../lib/taxonomy';
import * as relationsApi from '../../../../lib/taxonomyRelations';

const taxonomyMocks = vi.hoisted(() => ({
  getTrait: vi.fn(),
  getBiome: vi.fn(),
  getSpecies: vi.fn(),
  getEcosystem: vi.fn(),
  listAllTraits: vi.fn(),
  listAllBiomes: vi.fn(),
  listAllSpecies: vi.fn(),
  listAllEcosystems: vi.fn(),
}));

const relationMocks = vi.hoisted(() => ({
  getSpeciesTraits: vi.fn(),
  getSpeciesBiomes: vi.fn(),
  getEcosystemBiomes: vi.fn(),
  getEcosystemSpecies: vi.fn(),
}));

vi.mock('../../../../lib/taxonomy', async () => {
  const actual = await vi.importActual<typeof import('../../../../lib/taxonomy')>(
    '../../../../lib/taxonomy',
  );
  return {
    ...actual,
    getTrait: taxonomyMocks.getTrait,
    getBiome: taxonomyMocks.getBiome,
    getSpecies: taxonomyMocks.getSpecies,
    getEcosystem: taxonomyMocks.getEcosystem,
    listAllTraits: taxonomyMocks.listAllTraits,
    listAllBiomes: taxonomyMocks.listAllBiomes,
    listAllSpecies: taxonomyMocks.listAllSpecies,
    listAllEcosystems: taxonomyMocks.listAllEcosystems,
  };
});

vi.mock('../../../../lib/taxonomyRelations', async () => {
  const actual = await vi.importActual<typeof import('../../../../lib/taxonomyRelations')>(
    '../../../../lib/taxonomyRelations',
  );
  return {
    ...actual,
    getSpeciesTraits: relationMocks.getSpeciesTraits,
    getSpeciesBiomes: relationMocks.getSpeciesBiomes,
    getEcosystemBiomes: relationMocks.getEcosystemBiomes,
    getEcosystemSpecies: relationMocks.getEcosystemSpecies,
  };
});

const getTraitMock = taxonomyApi.getTrait as unknown as Mock;
const getBiomeMock = taxonomyApi.getBiome as unknown as Mock;
const getSpeciesMock = taxonomyApi.getSpecies as unknown as Mock;
const getEcosystemMock = taxonomyApi.getEcosystem as unknown as Mock;
const listAllTraitsMock = taxonomyApi.listAllTraits as unknown as Mock;
const listAllBiomesMock = taxonomyApi.listAllBiomes as unknown as Mock;
const listAllSpeciesMock = taxonomyApi.listAllSpecies as unknown as Mock;
const listAllEcosystemsMock = taxonomyApi.listAllEcosystems as unknown as Mock;
const getSpeciesTraitsMock = relationsApi.getSpeciesTraits as unknown as Mock;
const getSpeciesBiomesMock = relationsApi.getSpeciesBiomes as unknown as Mock;
const getEcosystemBiomesMock = relationsApi.getEcosystemBiomes as unknown as Mock;
const getEcosystemSpeciesMock = relationsApi.getEcosystemSpecies as unknown as Mock;

function renderRoute(path: string, routePath: string, element: ReactElement) {
  return renderWithProviders(<div />, {
    router: {
      routes: [{ path: routePath, element }],
      initialEntries: [path],
    },
  });
}

describe('Taxonomy Details Pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getTraitMock.mockResolvedValue({
      id: 'trait-1',
      slug: 'social-structure',
      name: 'Struttura sociale',
      category: 'Comportamento',
      dataType: 'TEXT',
      unit: null,
      description: 'Descrizione trait.',
    });
    getBiomeMock.mockResolvedValue({
      id: 'biome-1',
      slug: 'coastal-wetland',
      name: 'Zona umida costiera',
      climate: 'Temperato',
      description: 'Descrizione bioma.',
      parentId: null,
    });
    getSpeciesMock.mockResolvedValue({
      id: 'species-1',
      slug: 'emys-orbicularis',
      scientificName: 'Emys orbicularis',
      commonName: 'Testuggine palustre europea',
      kingdom: 'Animalia',
      phylum: 'Chordata',
      class: 'Reptilia',
      order: 'Testudines',
      family: 'Emydidae',
      genus: 'Emys',
      epithet: 'orbicularis',
      status: 'Least Concern',
      description: 'Descrizione specie.',
    });
    getEcosystemMock.mockResolvedValue({
      id: 'ecosystem-1',
      slug: 'coastal-lagoon',
      name: 'Laguna costiera',
      region: 'Mediterraneo',
      climate: 'Temperato marittimo',
      description: 'Descrizione ecosistema.',
    });

    listAllTraitsMock.mockResolvedValue([
      { id: 'trait-1', slug: 'social-structure', name: 'Struttura sociale', category: 'Comportamento', dataType: 'TEXT' },
    ]);
    listAllBiomesMock.mockResolvedValue([
      { id: 'biome-1', slug: 'coastal-wetland', name: 'Zona umida costiera', climate: 'Temperato' },
    ]);
    listAllSpeciesMock.mockResolvedValue([
      { id: 'species-1', slug: 'emys-orbicularis', scientificName: 'Emys orbicularis' },
    ]);
    listAllEcosystemsMock.mockResolvedValue([
      { id: 'ecosystem-1', slug: 'coastal-lagoon', name: 'Laguna costiera' },
    ]);

    getSpeciesTraitsMock.mockResolvedValue([
      {
        id: 'species-trait-1',
        speciesId: 'species-1',
        traitId: 'trait-1',
        text: 'sociale complessa',
      },
    ]);
    getSpeciesBiomesMock.mockResolvedValue([
      {
        id: 'species-biome-1',
        speciesId: 'species-1',
        biomeId: 'biome-1',
        presence: 'resident',
      },
    ]);
    getEcosystemBiomesMock.mockResolvedValue([
      {
        id: 'ecosystem-biome-1',
        ecosystemId: 'ecosystem-1',
        biomeId: 'biome-1',
        proportion: 0.7,
      },
    ]);
    getEcosystemSpeciesMock.mockResolvedValue([
      {
        id: 'ecosystem-species-1',
        ecosystemId: 'ecosystem-1',
        speciesId: 'species-1',
        role: 'common',
      },
    ]);
  });

  it('renders trait detail with related species links', async () => {
    renderRoute('/traits/trait-1', '/traits/:traitId', <TraitDetailsPage />);

    expect(await screen.findByRole('heading', { name: 'Struttura sociale' })).toBeInTheDocument();
    expect(getTraitMock).toHaveBeenCalledWith('trait-1');
    expect(getSpeciesTraitsMock).toHaveBeenCalledWith({ traitId: 'trait-1' });

    const speciesLink = screen.getByRole('link', { name: 'Emys orbicularis' });
    expect(speciesLink).toHaveAttribute('href', '/species/species-1');
    expect(screen.getByText('sociale complessa')).toBeInTheDocument();
  });

  it('shows trait empty state when no relations are available', async () => {
    getSpeciesTraitsMock.mockResolvedValueOnce([]);

    renderRoute('/traits/trait-1', '/traits/:traitId', <TraitDetailsPage />);

    expect(await screen.findByRole('heading', { name: 'Struttura sociale' })).toBeInTheDocument();
    expect(screen.getByText('Nessuna relazione disponibile.')).toBeInTheDocument();
  });

  it('renders biome detail with related species and ecosystem links', async () => {
    renderRoute('/biomes/biome-1', '/biomes/:biomeId', <BiomeDetailsPage />);

    expect(await screen.findByRole('heading', { name: 'Zona umida costiera' })).toBeInTheDocument();
    expect(getBiomeMock).toHaveBeenCalledWith('biome-1');

    expect(screen.getByRole('link', { name: 'Emys orbicularis' })).toHaveAttribute('href', '/species/species-1');
    expect(screen.getByRole('link', { name: 'Laguna costiera' })).toHaveAttribute('href', '/ecosystems/ecosystem-1');
  });

  it('renders species detail with related trait, biome and ecosystem links', async () => {
    renderRoute('/species/species-1', '/species/:speciesId', <SpeciesDetailsPage />);

    expect(await screen.findByRole('heading', { name: 'Emys orbicularis' })).toBeInTheDocument();
    expect(getSpeciesMock).toHaveBeenCalledWith('species-1');

    expect(screen.getByRole('link', { name: 'Struttura sociale' })).toHaveAttribute('href', '/traits/trait-1');
    expect(screen.getByRole('link', { name: 'Zona umida costiera' })).toHaveAttribute('href', '/biomes/biome-1');
    expect(screen.getByRole('link', { name: 'Laguna costiera' })).toHaveAttribute('href', '/ecosystems/ecosystem-1');
  });

  it('renders ecosystem detail with related biome and species links', async () => {
    renderRoute('/ecosystems/ecosystem-1', '/ecosystems/:ecosystemId', <EcosystemDetailsPage />);

    expect(await screen.findByRole('heading', { name: 'Laguna costiera' })).toBeInTheDocument();
    expect(getEcosystemMock).toHaveBeenCalledWith('ecosystem-1');

    expect(screen.getByRole('link', { name: 'Zona umida costiera' })).toHaveAttribute('href', '/biomes/biome-1');
    expect(screen.getByRole('link', { name: 'Emys orbicularis' })).toHaveAttribute('href', '/species/species-1');
  });
});

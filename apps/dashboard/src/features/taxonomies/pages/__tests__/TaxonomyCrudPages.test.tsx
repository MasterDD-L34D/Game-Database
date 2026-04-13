import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BiomeListPage from '../BiomeListPage';
import EcosystemListPage from '../EcosystemListPage';
import SpeciesListPage from '../SpeciesListPage';
import { renderListPage } from '../../../../testUtils/renderWithProviders';

type BiomeType = {
  id: string;
  slug: string;
  name: string;
  climate?: string | null;
  parentId?: string | null;
  description?: string | null;
};

type SpeciesType = {
  id: string;
  slug: string;
  scientificName: string;
  commonName?: string | null;
  kingdom?: string | null;
  phylum?: string | null;
  class?: string | null;
  order?: string | null;
  family?: string | null;
  genus?: string | null;
  epithet?: string | null;
  status?: string | null;
  description?: string | null;
};

type EcosystemType = {
  id: string;
  slug: string;
  name: string;
  region?: string | null;
  climate?: string | null;
  description?: string | null;
};

const taxonomyMocks = vi.hoisted(() => {
  const baseBiomes: BiomeType[] = [
    {
      id: 'biome-1',
      slug: 'temperate-forest',
      name: 'Foresta temperata',
      climate: 'Temperato umido',
      parentId: null,
      description: 'Bioma forestale delle medie latitudini.',
    },
    {
      id: 'biome-2',
      slug: 'coastal-wetland',
      name: 'Zona umida costiera',
      climate: 'Marittimo',
      parentId: 'biome-1',
      description: 'Area di transizione tra terra e mare.',
    },
  ];

  const baseSpecies: SpeciesType[] = [
    {
      id: 'species-1',
      slug: 'lutra-lutra',
      scientificName: 'Lutra lutra',
      commonName: 'Lontra europea',
      kingdom: 'Animalia',
      phylum: 'Chordata',
      class: 'Mammalia',
      order: 'Carnivora',
      family: 'Mustelidae',
      genus: 'Lutra',
      epithet: 'lutra',
      status: 'Least Concern',
      description: 'Mustelide semiacquatico diffuso in Eurasia.',
    },
    {
      id: 'species-2',
      slug: 'haliaeetus-albicilla',
      scientificName: 'Haliaeetus albicilla',
      commonName: 'Aquila di mare',
      kingdom: 'Animalia',
      phylum: 'Chordata',
      class: 'Aves',
      order: 'Accipitriformes',
      family: 'Accipitridae',
      genus: 'Haliaeetus',
      epithet: 'albicilla',
      status: 'Least Concern',
      description: 'Grande rapace legato agli ambienti costieri.',
    },
  ];

  const baseEcosystems: EcosystemType[] = [
    {
      id: 'ecosystem-1',
      slug: 'lagoon-mosaic',
      name: 'Mosaico lagunare',
      region: 'Mediterraneo',
      climate: 'Temperato marittimo',
      description: 'Sistema di canali, barene e velme.',
    },
    {
      id: 'ecosystem-2',
      slug: 'alpine-ridge',
      name: 'Cresta alpina',
      region: 'Arco alpino',
      climate: 'Freddo nivale',
      description: 'Habitat d alta quota con forte esposizione.',
    },
  ];

  const biomes: BiomeType[] = baseBiomes.map((item) => ({ ...item }));
  const species: SpeciesType[] = baseSpecies.map((item) => ({ ...item }));
  const ecosystems: EcosystemType[] = baseEcosystems.map((item) => ({ ...item }));

  const listBiomes = vi.fn(async () => ({
    items: biomes.map((item) => ({ ...item })),
    page: 0,
    pageSize: 25,
    total: biomes.length,
  }));

  const createBiome = vi.fn(async (payload: Omit<BiomeType, 'id'>) => {
    const next = { id: `biome-${biomes.length + 1}`, ...payload } satisfies BiomeType;
    biomes.push({ ...next });
    return next;
  });

  const updateBiome = vi.fn(async (id: string, payload: Partial<BiomeType>) => {
    const index = biomes.findIndex((item) => item.id === id);
    if (index >= 0) biomes[index] = { ...biomes[index], ...payload };
    return biomes[index];
  });

  const deleteBiome = vi.fn(async (id: string) => {
    const index = biomes.findIndex((item) => item.id === id);
    if (index >= 0) biomes.splice(index, 1);
  });

  const listSpecies = vi.fn(async () => ({
    items: species.map((item) => ({ ...item })),
    page: 0,
    pageSize: 25,
    total: species.length,
  }));

  const createSpecies = vi.fn(async (payload: Omit<SpeciesType, 'id'>) => {
    const next = { id: `species-${species.length + 1}`, ...payload } satisfies SpeciesType;
    species.push({ ...next });
    return next;
  });

  const updateSpecies = vi.fn(async (id: string, payload: Partial<SpeciesType>) => {
    const index = species.findIndex((item) => item.id === id);
    if (index >= 0) species[index] = { ...species[index], ...payload };
    return species[index];
  });

  const deleteSpecies = vi.fn(async (id: string) => {
    const index = species.findIndex((item) => item.id === id);
    if (index >= 0) species.splice(index, 1);
  });

  const listEcosystems = vi.fn(async () => ({
    items: ecosystems.map((item) => ({ ...item })),
    page: 0,
    pageSize: 25,
    total: ecosystems.length,
  }));

  const createEcosystem = vi.fn(async (payload: Omit<EcosystemType, 'id'>) => {
    const next = { id: `ecosystem-${ecosystems.length + 1}`, ...payload } satisfies EcosystemType;
    ecosystems.push({ ...next });
    return next;
  });

  const updateEcosystem = vi.fn(async (id: string, payload: Partial<EcosystemType>) => {
    const index = ecosystems.findIndex((item) => item.id === id);
    if (index >= 0) ecosystems[index] = { ...ecosystems[index], ...payload };
    return ecosystems[index];
  });

  const deleteEcosystem = vi.fn(async (id: string) => {
    const index = ecosystems.findIndex((item) => item.id === id);
    if (index >= 0) ecosystems.splice(index, 1);
  });

  const reset = () => {
    biomes.splice(0, biomes.length, ...baseBiomes.map((item) => ({ ...item })));
    species.splice(0, species.length, ...baseSpecies.map((item) => ({ ...item })));
    ecosystems.splice(0, ecosystems.length, ...baseEcosystems.map((item) => ({ ...item })));
    [
      listBiomes,
      createBiome,
      updateBiome,
      deleteBiome,
      listSpecies,
      createSpecies,
      updateSpecies,
      deleteSpecies,
      listEcosystems,
      createEcosystem,
      updateEcosystem,
      deleteEcosystem,
    ].forEach((mock) => mock.mockClear());
  };

  return {
    listBiomes,
    createBiome,
    updateBiome,
    deleteBiome,
    listSpecies,
    createSpecies,
    updateSpecies,
    deleteSpecies,
    listEcosystems,
    createEcosystem,
    updateEcosystem,
    deleteEcosystem,
    reset,
  };
});

vi.mock('../../../../lib/taxonomy', async () => {
  const actual = await vi.importActual<typeof import('../../../../lib/taxonomy')>('../../../../lib/taxonomy');
  return {
    ...actual,
    listBiomes: taxonomyMocks.listBiomes,
    createBiome: taxonomyMocks.createBiome,
    updateBiome: taxonomyMocks.updateBiome,
    deleteBiome: taxonomyMocks.deleteBiome,
    listSpecies: taxonomyMocks.listSpecies,
    createSpecies: taxonomyMocks.createSpecies,
    updateSpecies: taxonomyMocks.updateSpecies,
    deleteSpecies: taxonomyMocks.deleteSpecies,
    listEcosystems: taxonomyMocks.listEcosystems,
    createEcosystem: taxonomyMocks.createEcosystem,
    updateEcosystem: taxonomyMocks.updateEcosystem,
    deleteEcosystem: taxonomyMocks.deleteEcosystem,
  };
});

describe('Taxonomy CRUD Pages', () => {
  beforeEach(() => {
    taxonomyMocks.reset();
  });

  it('allows creating, editing and deleting biomes', async () => {
    const user = userEvent.setup();
    renderListPage(<BiomeListPage />);

    await waitFor(() => expect(taxonomyMocks.listBiomes).toHaveBeenCalledTimes(1));
    await screen.findByText('Foresta temperata');

    await user.click(screen.getByRole('button', { name: /nuovo bioma/i }));
    const createDialog = await screen.findByRole('dialog');
    const createScope = within(createDialog);
    await user.type(createScope.getByLabelText(/slug/i), 'delta-estuary');
    await user.type(createScope.getByLabelText(/nome/i, { selector: 'input' }), 'Delta estuarino');
    await user.type(createScope.getByLabelText(/clima/i), 'Subtropicale umido');
    await user.type(createScope.getByLabelText(/bioma padre/i), 'biome-1');
    await user.type(createScope.getByLabelText(/descrizione/i), 'Ambiente di foce ad alta produttività.');
    await user.click(screen.getByRole('button', { name: /salva$/i }));

    await screen.findByText('Bioma creato con successo.');
    await waitFor(() => expect(taxonomyMocks.listBiomes).toHaveBeenCalledTimes(2));
    expect(taxonomyMocks.createBiome).toHaveBeenCalledWith({
      slug: 'delta-estuary',
      name: 'Delta estuarino',
      climate: 'Subtropicale umido',
      parentId: 'biome-1',
      description: 'Ambiente di foce ad alta produttività.',
    });

    const wetlandRow = screen.getByText('Zona umida costiera').closest('tr');
    if (!wetlandRow) throw new Error('Row not found');
    await user.click(await within(wetlandRow).findByRole('button', { name: /azioni/i }));
    await user.click(await screen.findByRole('menuitem', { name: /modifica/i }));
    const editDialog = await screen.findByRole('dialog');
    const climateInput = within(editDialog).getByLabelText(/clima/i);
    await user.clear(climateInput);
    await user.type(climateInput, 'Marittimo temperato');
    await user.click(screen.getByRole('button', { name: /salva modifiche/i }));

    await screen.findByText('Bioma aggiornato con successo.');
    expect(taxonomyMocks.updateBiome).toHaveBeenCalledWith('biome-2', {
      slug: 'coastal-wetland',
      name: 'Zona umida costiera',
      climate: 'Marittimo temperato',
      parentId: 'biome-1',
      description: 'Area di transizione tra terra e mare.',
    });

    const forestRow = screen.getByText('Foresta temperata').closest('tr');
    if (!forestRow) throw new Error('Row not found');
    await user.click(await within(forestRow).findByRole('button', { name: /azioni/i }));
    await user.click(await screen.findByRole('menuitem', { name: /elimina/i }));
    await user.click(screen.getByRole('button', { name: /^elimina$/i }));

    await screen.findByText('Bioma eliminato con successo.');
    expect(taxonomyMocks.deleteBiome).toHaveBeenCalledWith('biome-1');
  });

  it('allows creating, editing and deleting species', { timeout: 10000 }, async () => {
    const user = userEvent.setup();
    renderListPage(<SpeciesListPage />);

    await waitFor(() => expect(taxonomyMocks.listSpecies).toHaveBeenCalledTimes(1));
    await screen.findByText('Lutra lutra');

    await user.click(screen.getByRole('button', { name: /nuova specie/i }));
    const createDialog = await screen.findByRole('dialog');
    const createScope = within(createDialog);
    await user.type(createScope.getByLabelText(/slug/i), 'phalacrocorax-carbo');
    await user.type(createScope.getByLabelText(/nome scientifico/i), 'Phalacrocorax carbo');
    await user.type(createScope.getByLabelText(/nome comune/i), 'Cormorano comune');
    await user.type(createScope.getByLabelText(/regno/i), 'Animalia');
    await user.type(createScope.getByLabelText(/phylum/i), 'Chordata');
    await user.type(createScope.getByLabelText(/classe/i), 'Aves');
    await user.type(createScope.getByLabelText(/ordine/i), 'Suliformes');
    await user.type(createScope.getByLabelText(/famiglia/i), 'Phalacrocoracidae');
    await user.type(createScope.getByLabelText(/genere/i), 'Phalacrocorax');
    await user.type(createScope.getByLabelText(/epiteto/i), 'carbo');
    await user.type(createScope.getByLabelText(/stato/i), 'Least Concern');
    await user.type(createScope.getByLabelText(/descrizione/i), 'Uccello ittiofago di ambienti costieri e interni.');
    await user.click(screen.getByRole('button', { name: /salva$/i }));

    await screen.findByText('Specie creata con successo.');
    expect(taxonomyMocks.createSpecies).toHaveBeenCalledWith({
      slug: 'phalacrocorax-carbo',
      scientificName: 'Phalacrocorax carbo',
      commonName: 'Cormorano comune',
      kingdom: 'Animalia',
      phylum: 'Chordata',
      class: 'Aves',
      order: 'Suliformes',
      family: 'Phalacrocoracidae',
      genus: 'Phalacrocorax',
      epithet: 'carbo',
      status: 'Least Concern',
      description: 'Uccello ittiofago di ambienti costieri e interni.',
    });

    const eagleRow = screen.getByText('Haliaeetus albicilla').closest('tr');
    if (!eagleRow) throw new Error('Row not found');
    await user.click(await within(eagleRow).findByRole('button', { name: /azioni/i }));
    await user.click(await screen.findByRole('menuitem', { name: /modifica/i }));
    const editDialog = await screen.findByRole('dialog');
    const statusInput = within(editDialog).getByLabelText(/stato/i);
    await user.clear(statusInput);
    await user.type(statusInput, 'Protected');
    await user.click(screen.getByRole('button', { name: /salva modifiche/i }));

    await screen.findByText('Specie aggiornata con successo.');
    expect(taxonomyMocks.updateSpecies).toHaveBeenCalledWith('species-2', {
      slug: 'haliaeetus-albicilla',
      scientificName: 'Haliaeetus albicilla',
      commonName: 'Aquila di mare',
      kingdom: 'Animalia',
      phylum: 'Chordata',
      class: 'Aves',
      order: 'Accipitriformes',
      family: 'Accipitridae',
      genus: 'Haliaeetus',
      epithet: 'albicilla',
      status: 'Protected',
      description: 'Grande rapace legato agli ambienti costieri.',
    });

    const otterRow = screen.getByText('Lutra lutra').closest('tr');
    if (!otterRow) throw new Error('Row not found');
    await user.click(await within(otterRow).findByRole('button', { name: /azioni/i }));
    await user.click(await screen.findByRole('menuitem', { name: /elimina/i }));
    await user.click(screen.getByRole('button', { name: /^elimina$/i }));

    await screen.findByText('Specie eliminata con successo.');
    expect(taxonomyMocks.deleteSpecies).toHaveBeenCalledWith('species-1');
  });

  it('allows creating, editing and deleting ecosystems', async () => {
    const user = userEvent.setup();
    renderListPage(<EcosystemListPage />);

    await waitFor(() => expect(taxonomyMocks.listEcosystems).toHaveBeenCalledTimes(1));
    await screen.findByText('Mosaico lagunare');

    await user.click(screen.getByRole('button', { name: /nuovo ecosistema/i }));
    const createDialog = await screen.findByRole('dialog');
    const createScope = within(createDialog);
    await user.type(createScope.getByLabelText(/slug/i), 'tidal-marsh-complex');
    await user.type(createScope.getByLabelText(/nome/i, { selector: 'input' }), 'Complesso di palude tidale');
    await user.type(createScope.getByLabelText(/regione/i), 'Atlantico nordorientale');
    await user.type(createScope.getByLabelText(/clima/i), 'Oceanico fresco');
    await user.type(createScope.getByLabelText(/descrizione/i), 'Sistema salmastro influenzato dalle maree.');
    await user.click(screen.getByRole('button', { name: /salva$/i }));

    await screen.findByText('Ecosistema creato con successo.');
    expect(taxonomyMocks.createEcosystem).toHaveBeenCalledWith({
      slug: 'tidal-marsh-complex',
      name: 'Complesso di palude tidale',
      region: 'Atlantico nordorientale',
      climate: 'Oceanico fresco',
      description: 'Sistema salmastro influenzato dalle maree.',
    });

    const alpineRow = screen.getByText('Cresta alpina').closest('tr');
    if (!alpineRow) throw new Error('Row not found');
    await user.click(await within(alpineRow).findByRole('button', { name: /azioni/i }));
    await user.click(await screen.findByRole('menuitem', { name: /modifica/i }));
    const editDialog = await screen.findByRole('dialog');
    const regionInput = within(editDialog).getByLabelText(/regione/i);
    await user.clear(regionInput);
    await user.type(regionInput, 'Alpi orientali');
    await user.click(screen.getByRole('button', { name: /salva modifiche/i }));

    await screen.findByText('Ecosistema aggiornato con successo.');
    expect(taxonomyMocks.updateEcosystem).toHaveBeenCalledWith('ecosystem-2', {
      slug: 'alpine-ridge',
      name: 'Cresta alpina',
      region: 'Alpi orientali',
      climate: 'Freddo nivale',
      description: 'Habitat d alta quota con forte esposizione.',
    });

    const lagoonRow = screen.getByText('Mosaico lagunare').closest('tr');
    if (!lagoonRow) throw new Error('Row not found');
    await user.click(await within(lagoonRow).findByRole('button', { name: /azioni/i }));
    await user.click(await screen.findByRole('menuitem', { name: /elimina/i }));
    await user.click(screen.getByRole('button', { name: /^elimina$/i }));

    await screen.findByText('Ecosistema eliminato con successo.');
    expect(taxonomyMocks.deleteEcosystem).toHaveBeenCalledWith('ecosystem-1');
  });
});

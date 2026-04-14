import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderListPage } from '../../../../testUtils/renderWithProviders';
import SpeciesTraitListPage from '../SpeciesTraitListPage';
import SpeciesBiomeListPage from '../SpeciesBiomeListPage';
import EcosystemBiomeListPage from '../EcosystemBiomeListPage';
import EcosystemSpeciesListPage from '../EcosystemSpeciesListPage';

type SpeciesItem = { id: string; scientificName: string };
type TraitItem = { id: string; name: string; dataType: 'TEXT' | 'NUMERIC' | 'BOOLEAN' | 'CATEGORICAL' };
type BiomeItem = { id: string; name: string };
type EcosystemItem = { id: string; name: string };

type SpeciesTraitRelation = {
  id: string;
  speciesId: string;
  traitId: string;
  category?: string | null;
  text?: string | null;
  source?: string | null;
};

type SpeciesBiomeRelation = {
  id: string;
  speciesId: string;
  biomeId: string;
  presence: 'resident' | 'migrant' | 'introduced' | 'endemic' | 'unknown';
  abundance?: number | null;
  notes?: string | null;
};

type EcosystemBiomeRelation = {
  id: string;
  ecosystemId: string;
  biomeId: string;
  proportion?: number | null;
  notes?: string | null;
};

type EcosystemSpeciesRelation = {
  id: string;
  ecosystemId: string;
  speciesId: string;
  role: 'keystone' | 'dominant' | 'engineer' | 'common' | 'invasive' | 'other';
  abundance?: number | null;
  notes?: string | null;
};

const relationMocks = vi.hoisted(() => {
  const baseSpecies: SpeciesItem[] = [
    { id: 'species-1', scientificName: 'Emys orbicularis' },
    { id: 'species-2', scientificName: 'Lynx lynx' },
  ];

  const baseTraits: TraitItem[] = [
    { id: 'trait-1', name: 'Struttura sociale', dataType: 'TEXT' },
    { id: 'trait-2', name: 'Temperatura corporea', dataType: 'NUMERIC' },
  ];

  const baseBiomes: BiomeItem[] = [
    { id: 'biome-1', name: 'Zona umida costiera' },
    { id: 'biome-2', name: 'Foresta temperata' },
  ];

  const baseEcosystems: EcosystemItem[] = [
    { id: 'eco-1', name: 'Laguna costiera' },
    { id: 'eco-2', name: 'Bosco planiziale' },
  ];

  const baseSpeciesTraits: SpeciesTraitRelation[] = [
    {
      id: 'species-trait-1',
      speciesId: 'species-1',
      traitId: 'trait-1',
      category: 'baseline',
      text: 'solitaria',
      source: 'seed',
    },
  ];

  const baseSpeciesBiomes: SpeciesBiomeRelation[] = [
    {
      id: 'species-biome-1',
      speciesId: 'species-1',
      biomeId: 'biome-1',
      presence: 'resident',
      abundance: 5,
      notes: 'seed',
    },
  ];

  const baseEcosystemBiomes: EcosystemBiomeRelation[] = [
    {
      id: 'eco-biome-1',
      ecosystemId: 'eco-1',
      biomeId: 'biome-1',
      proportion: 0.4,
      notes: 'seed',
    },
  ];

  const baseEcosystemSpecies: EcosystemSpeciesRelation[] = [
    {
      id: 'eco-species-1',
      ecosystemId: 'eco-1',
      speciesId: 'species-1',
      role: 'common',
      abundance: 12,
      notes: 'seed',
    },
  ];

  const species: SpeciesItem[] = [];
  const traits: TraitItem[] = [];
  const biomes: BiomeItem[] = [];
  const ecosystems: EcosystemItem[] = [];
  const speciesTraits: SpeciesTraitRelation[] = [];
  const speciesBiomes: SpeciesBiomeRelation[] = [];
  const ecosystemBiomes: EcosystemBiomeRelation[] = [];
  const ecosystemSpecies: EcosystemSpeciesRelation[] = [];

  const listSpecies = vi.fn(async () => ({ items: species.map((item) => ({ ...item })), page: 0, pageSize: 100, total: species.length }));
  const listAllTraits = vi.fn(async () => traits.map((item) => ({ ...item })));
  const listBiomes = vi.fn(async () => ({ items: biomes.map((item) => ({ ...item })), page: 0, pageSize: 100, total: biomes.length }));
  const listEcosystems = vi.fn(async () => ({ items: ecosystems.map((item) => ({ ...item })), page: 0, pageSize: 100, total: ecosystems.length }));

  const listSpeciesTraits = vi.fn(async () => ({ items: speciesTraits.map((item) => ({ ...item })), page: 0, pageSize: 25, total: speciesTraits.length }));
  const createSpeciesTrait = vi.fn(async (payload: Omit<SpeciesTraitRelation, 'id'>) => {
    const next: SpeciesTraitRelation = { id: `species-trait-${speciesTraits.length + 1}`, ...payload };
    speciesTraits.push({ ...next });
    return next;
  });
  const updateSpeciesTrait = vi.fn(async (id: string, payload: Partial<Omit<SpeciesTraitRelation, 'id'>>) => {
    const index = speciesTraits.findIndex((item) => item.id === id);
    if (index >= 0) speciesTraits[index] = { ...speciesTraits[index], ...payload };
    return speciesTraits[index];
  });
  const deleteSpeciesTrait = vi.fn(async (id: string) => {
    const index = speciesTraits.findIndex((item) => item.id === id);
    if (index >= 0) speciesTraits.splice(index, 1);
  });

  const listSpeciesBiomes = vi.fn(async () => ({ items: speciesBiomes.map((item) => ({ ...item })), page: 0, pageSize: 25, total: speciesBiomes.length }));
  const createSpeciesBiome = vi.fn(async (payload: Omit<SpeciesBiomeRelation, 'id'>) => {
    const next: SpeciesBiomeRelation = { id: `species-biome-${speciesBiomes.length + 1}`, ...payload };
    speciesBiomes.push({ ...next });
    return next;
  });
  const updateSpeciesBiome = vi.fn(async (id: string, payload: Partial<Omit<SpeciesBiomeRelation, 'id'>>) => {
    const index = speciesBiomes.findIndex((item) => item.id === id);
    if (index >= 0) speciesBiomes[index] = { ...speciesBiomes[index], ...payload };
    return speciesBiomes[index];
  });
  const deleteSpeciesBiome = vi.fn(async (id: string) => {
    const index = speciesBiomes.findIndex((item) => item.id === id);
    if (index >= 0) speciesBiomes.splice(index, 1);
  });

  const listEcosystemBiomes = vi.fn(async () => ({ items: ecosystemBiomes.map((item) => ({ ...item })), page: 0, pageSize: 25, total: ecosystemBiomes.length }));
  const createEcosystemBiome = vi.fn(async (payload: Omit<EcosystemBiomeRelation, 'id'>) => {
    const next: EcosystemBiomeRelation = { id: `eco-biome-${ecosystemBiomes.length + 1}`, ...payload };
    ecosystemBiomes.push({ ...next });
    return next;
  });
  const updateEcosystemBiome = vi.fn(async (id: string, payload: Partial<Omit<EcosystemBiomeRelation, 'id'>>) => {
    const index = ecosystemBiomes.findIndex((item) => item.id === id);
    if (index >= 0) ecosystemBiomes[index] = { ...ecosystemBiomes[index], ...payload };
    return ecosystemBiomes[index];
  });
  const deleteEcosystemBiome = vi.fn(async (id: string) => {
    const index = ecosystemBiomes.findIndex((item) => item.id === id);
    if (index >= 0) ecosystemBiomes.splice(index, 1);
  });

  const listEcosystemSpecies = vi.fn(async () => ({ items: ecosystemSpecies.map((item) => ({ ...item })), page: 0, pageSize: 25, total: ecosystemSpecies.length }));
  const createEcosystemSpecies = vi.fn(async (payload: Omit<EcosystemSpeciesRelation, 'id'>) => {
    const next: EcosystemSpeciesRelation = { id: `eco-species-${ecosystemSpecies.length + 1}`, ...payload };
    ecosystemSpecies.push({ ...next });
    return next;
  });
  const updateEcosystemSpecies = vi.fn(async (id: string, payload: Partial<Omit<EcosystemSpeciesRelation, 'id'>>) => {
    const index = ecosystemSpecies.findIndex((item) => item.id === id);
    if (index >= 0) ecosystemSpecies[index] = { ...ecosystemSpecies[index], ...payload };
    return ecosystemSpecies[index];
  });
  const deleteEcosystemSpecies = vi.fn(async (id: string) => {
    const index = ecosystemSpecies.findIndex((item) => item.id === id);
    if (index >= 0) ecosystemSpecies.splice(index, 1);
  });

  const reset = () => {
    species.splice(0, species.length, ...baseSpecies.map((item) => ({ ...item })));
    traits.splice(0, traits.length, ...baseTraits.map((item) => ({ ...item })));
    biomes.splice(0, biomes.length, ...baseBiomes.map((item) => ({ ...item })));
    ecosystems.splice(0, ecosystems.length, ...baseEcosystems.map((item) => ({ ...item })));
    speciesTraits.splice(0, speciesTraits.length, ...baseSpeciesTraits.map((item) => ({ ...item })));
    speciesBiomes.splice(0, speciesBiomes.length, ...baseSpeciesBiomes.map((item) => ({ ...item })));
    ecosystemBiomes.splice(0, ecosystemBiomes.length, ...baseEcosystemBiomes.map((item) => ({ ...item })));
    ecosystemSpecies.splice(0, ecosystemSpecies.length, ...baseEcosystemSpecies.map((item) => ({ ...item })));

    [
      listSpecies,
      listAllTraits,
      listBiomes,
      listEcosystems,
      listSpeciesTraits,
      createSpeciesTrait,
      updateSpeciesTrait,
      deleteSpeciesTrait,
      listSpeciesBiomes,
      createSpeciesBiome,
      updateSpeciesBiome,
      deleteSpeciesBiome,
      listEcosystemBiomes,
      createEcosystemBiome,
      updateEcosystemBiome,
      deleteEcosystemBiome,
      listEcosystemSpecies,
      createEcosystemSpecies,
      updateEcosystemSpecies,
      deleteEcosystemSpecies,
    ].forEach((mock) => mock.mockClear());
  };

  return {
    listSpecies,
    listAllTraits,
    listBiomes,
    listEcosystems,
    listSpeciesTraits,
    createSpeciesTrait,
    updateSpeciesTrait,
    deleteSpeciesTrait,
    listSpeciesBiomes,
    createSpeciesBiome,
    updateSpeciesBiome,
    deleteSpeciesBiome,
    listEcosystemBiomes,
    createEcosystemBiome,
    updateEcosystemBiome,
    deleteEcosystemBiome,
    listEcosystemSpecies,
    createEcosystemSpecies,
    updateEcosystemSpecies,
    deleteEcosystemSpecies,
    reset,
  };
});

vi.mock('../../../../lib/taxonomy', async () => {
  const actual = await vi.importActual<typeof import('../../../../lib/taxonomy')>('../../../../lib/taxonomy');
  return {
    ...actual,
    listSpecies: relationMocks.listSpecies,
    listAllTraits: relationMocks.listAllTraits,
    listBiomes: relationMocks.listBiomes,
    listEcosystems: relationMocks.listEcosystems,
  };
});

vi.mock('../../../../lib/taxonomyRelations', async () => {
  const actual = await vi.importActual<typeof import('../../../../lib/taxonomyRelations')>('../../../../lib/taxonomyRelations');
  return {
    ...actual,
    listSpeciesTraits: relationMocks.listSpeciesTraits,
    createSpeciesTrait: relationMocks.createSpeciesTrait,
    updateSpeciesTrait: relationMocks.updateSpeciesTrait,
    deleteSpeciesTrait: relationMocks.deleteSpeciesTrait,
    listSpeciesBiomes: relationMocks.listSpeciesBiomes,
    createSpeciesBiome: relationMocks.createSpeciesBiome,
    updateSpeciesBiome: relationMocks.updateSpeciesBiome,
    deleteSpeciesBiome: relationMocks.deleteSpeciesBiome,
    listEcosystemBiomes: relationMocks.listEcosystemBiomes,
    createEcosystemBiome: relationMocks.createEcosystemBiome,
    updateEcosystemBiome: relationMocks.updateEcosystemBiome,
    deleteEcosystemBiome: relationMocks.deleteEcosystemBiome,
    listEcosystemSpecies: relationMocks.listEcosystemSpecies,
    createEcosystemSpecies: relationMocks.createEcosystemSpecies,
    updateEcosystemSpecies: relationMocks.updateEcosystemSpecies,
    deleteEcosystemSpecies: relationMocks.deleteEcosystemSpecies,
  };
});

async function chooseOption(user: ReturnType<typeof userEvent.setup>, scope: ReturnType<typeof within>, label: RegExp, option: string) {
  await user.click(scope.getByLabelText(label));
  await user.click(await screen.findByRole('option', { name: option }));
}

describe('Taxonomy Relation Pages', () => {
  beforeEach(() => {
    relationMocks.reset();
  });

  it('allows creating, editing and deleting species-trait relations', { timeout: 20000 }, async () => {
    const user = userEvent.setup();
    renderListPage(<SpeciesTraitListPage />);

    await screen.findByText('Relazioni specie-trait');
    await user.click(screen.getByRole('button', { name: /nuova relazione specie-trait/i }));

    const createDialog = await screen.findByRole('dialog');
    const createScope = within(createDialog);
    await chooseOption(user, createScope, /specie/i, 'Emys orbicularis');
    await chooseOption(user, createScope, /trait/i, 'Struttura sociale');
    await user.type(createScope.getByLabelText(/categoria/i), 'osservata');
    await user.type(createScope.getByLabelText(/testo/i), 'gregaria');
    await user.type(createScope.getByLabelText(/fonte/i), 'field notes');
    await user.click(screen.getByRole('button', { name: /salva$/i }));

    await screen.findByText('Relazione specie-trait creata con successo.');
    expect(relationMocks.createSpeciesTrait).toHaveBeenCalledWith(
      expect.objectContaining({
        speciesId: 'species-1',
        traitId: 'trait-1',
        category: 'osservata',
        text: 'gregaria',
        source: 'field notes',
      }),
    );

    const createdRow = screen.getByText('osservata').closest('tr');
    if (!createdRow) throw new Error('Row not found');
    await user.click(await within(createdRow).findByRole('button', { name: /azioni/i }));
    await user.click(await screen.findByRole('menuitem', { name: /modifica/i }));

    const editDialog = await screen.findByRole('dialog');
    const editScope = within(editDialog);
    const categoryInput = editScope.getByLabelText(/categoria/i);
    await user.clear(categoryInput);
    await user.type(categoryInput, 'osservata-aggiornata');
    await user.click(screen.getByRole('button', { name: /salva modifiche/i }));

    await screen.findByText('Relazione specie-trait aggiornata con successo.');
    expect(relationMocks.updateSpeciesTrait).toHaveBeenCalled();

    const updatedRow = screen.getByText('osservata-aggiornata').closest('tr');
    if (!updatedRow) throw new Error('Updated row not found');
    await user.click(await within(updatedRow).findByRole('button', { name: /azioni/i }));
    await user.click(await screen.findByRole('menuitem', { name: /elimina/i }));
    await user.click(screen.getByRole('button', { name: /^elimina$/i }));

    await screen.findByText('Relazione specie-trait eliminata con successo.');
    expect(relationMocks.deleteSpeciesTrait).toHaveBeenCalled();
  });

  it('allows creating, editing and deleting species-biome relations', { timeout: 20000 }, async () => {
    const user = userEvent.setup();
    renderListPage(<SpeciesBiomeListPage />);

    await screen.findByText('Relazioni specie-biomi');
    await user.click(screen.getByRole('button', { name: /nuova relazione specie-bioma/i }));

    const createDialog = await screen.findByRole('dialog');
    const createScope = within(createDialog);
    await chooseOption(user, createScope, /specie/i, 'Lynx lynx');
    await chooseOption(user, createScope, /bioma/i, 'Foresta temperata');
    await chooseOption(user, createScope, /presenza/i, 'resident');
    await user.type(createScope.getByLabelText(/abbondanza/i), '8');
    await user.type(createScope.getByLabelText(/note/i), 'created in test');
    await user.click(screen.getByRole('button', { name: /salva$/i }));

    await screen.findByText('Relazione specie-bioma creata con successo.');
    expect(relationMocks.createSpeciesBiome).toHaveBeenCalledWith(
      expect.objectContaining({
        speciesId: 'species-2',
        biomeId: 'biome-2',
        presence: 'resident',
        abundance: 8,
        notes: 'created in test',
      }),
    );

    const createdRow = screen.getByText('Lynx lynx').closest('tr');
    if (!createdRow) throw new Error('Row not found');
    await user.click(await within(createdRow).findByRole('button', { name: /azioni/i }));
    await user.click(await screen.findByRole('menuitem', { name: /modifica/i }));

    const editDialog = await screen.findByRole('dialog');
    const editScope = within(editDialog);
    await chooseOption(user, editScope, /presenza/i, 'migrant');
    await user.click(screen.getByRole('button', { name: /salva modifiche/i }));

    await screen.findByText('Relazione specie-bioma aggiornata con successo.');
    expect(relationMocks.updateSpeciesBiome).toHaveBeenCalled();

    const updatedRow = screen.getByText('Lynx lynx').closest('tr');
    if (!updatedRow) throw new Error('Updated row not found');
    await user.click(await within(updatedRow).findByRole('button', { name: /azioni/i }));
    await user.click(await screen.findByRole('menuitem', { name: /elimina/i }));
    await user.click(screen.getByRole('button', { name: /^elimina$/i }));

    await screen.findByText('Relazione specie-bioma eliminata con successo.');
    expect(relationMocks.deleteSpeciesBiome).toHaveBeenCalled();
  });

  it('allows creating, editing and deleting ecosystem-biome relations', { timeout: 20000 }, async () => {
    const user = userEvent.setup();
    renderListPage(<EcosystemBiomeListPage />);

    await screen.findByText('Relazioni ecosistemi-biomi');
    await user.click(screen.getByRole('button', { name: /nuova relazione ecosistema-bioma/i }));

    const createDialog = await screen.findByRole('dialog');
    const createScope = within(createDialog);
    await chooseOption(user, createScope, /ecosistema/i, 'Bosco planiziale');
    await chooseOption(user, createScope, /bioma/i, 'Foresta temperata');
    await user.type(createScope.getByLabelText(/proporzione/i), '0.65');
    await user.type(createScope.getByLabelText(/note/i), 'created in test');
    await user.click(screen.getByRole('button', { name: /salva$/i }));

    await screen.findByText('Relazione ecosistema-bioma creata con successo.');
    expect(relationMocks.createEcosystemBiome).toHaveBeenCalledWith(
      expect.objectContaining({
        ecosystemId: 'eco-2',
        biomeId: 'biome-2',
        proportion: 0.65,
        notes: 'created in test',
      }),
    );

    const createdRow = screen.getByText('Bosco planiziale').closest('tr');
    if (!createdRow) throw new Error('Row not found');
    await user.click(await within(createdRow).findByRole('button', { name: /azioni/i }));
    await user.click(await screen.findByRole('menuitem', { name: /modifica/i }));

    const editDialog = await screen.findByRole('dialog');
    const editScope = within(editDialog);
    const proportionInput = editScope.getByLabelText(/proporzione/i);
    await user.clear(proportionInput);
    await user.type(proportionInput, '0.75');
    await user.click(screen.getByRole('button', { name: /salva modifiche/i }));

    await screen.findByText('Relazione ecosistema-bioma aggiornata con successo.');
    expect(relationMocks.updateEcosystemBiome).toHaveBeenCalled();

    const updatedRow = screen.getByText('Bosco planiziale').closest('tr');
    if (!updatedRow) throw new Error('Updated row not found');
    await user.click(await within(updatedRow).findByRole('button', { name: /azioni/i }));
    await user.click(await screen.findByRole('menuitem', { name: /elimina/i }));
    await user.click(screen.getByRole('button', { name: /^elimina$/i }));

    await screen.findByText('Relazione ecosistema-bioma eliminata con successo.');
    expect(relationMocks.deleteEcosystemBiome).toHaveBeenCalled();
  });

  it('allows creating, editing and deleting ecosystem-species relations', { timeout: 20000 }, async () => {
    const user = userEvent.setup();
    renderListPage(<EcosystemSpeciesListPage />);

    await screen.findByText('Relazioni ecosistemi-specie');
    await user.click(screen.getByRole('button', { name: /nuova relazione ecosistema-specie/i }));

    const createDialog = await screen.findByRole('dialog');
    const createScope = within(createDialog);
    await chooseOption(user, createScope, /ecosistema/i, 'Bosco planiziale');
    await chooseOption(user, createScope, /specie/i, 'Lynx lynx');
    await chooseOption(user, createScope, /ruolo/i, 'common');
    await user.type(createScope.getByLabelText(/abbondanza/i), '4');
    await user.type(createScope.getByLabelText(/note/i), 'created in test');
    await user.click(screen.getByRole('button', { name: /salva$/i }));

    await screen.findByText('Relazione ecosistema-specie creata con successo.');
    expect(relationMocks.createEcosystemSpecies).toHaveBeenCalledWith(
      expect.objectContaining({
        ecosystemId: 'eco-2',
        speciesId: 'species-2',
        role: 'common',
        abundance: 4,
        notes: 'created in test',
      }),
    );

    const createdRow = screen.getByText('Bosco planiziale').closest('tr');
    if (!createdRow) throw new Error('Row not found');
    await user.click(await within(createdRow).findByRole('button', { name: /azioni/i }));
    await user.click(await screen.findByRole('menuitem', { name: /modifica/i }));

    const editDialog = await screen.findByRole('dialog');
    const editScope = within(editDialog);
    await chooseOption(user, editScope, /ruolo/i, 'dominant');
    await user.click(screen.getByRole('button', { name: /salva modifiche/i }));

    await screen.findByText('Relazione ecosistema-specie aggiornata con successo.');
    expect(relationMocks.updateEcosystemSpecies).toHaveBeenCalled();

    const updatedRow = screen.getByText('Bosco planiziale').closest('tr');
    if (!updatedRow) throw new Error('Updated row not found');
    await user.click(await within(updatedRow).findByRole('button', { name: /azioni/i }));
    await user.click(await screen.findByRole('menuitem', { name: /elimina/i }));
    await user.click(screen.getByRole('button', { name: /^elimina$/i }));

    await screen.findByText('Relazione ecosistema-specie eliminata con successo.');
    expect(relationMocks.deleteEcosystemSpecies).toHaveBeenCalled();
  });
});

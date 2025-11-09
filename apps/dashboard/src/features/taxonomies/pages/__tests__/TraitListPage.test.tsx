import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import TraitListPage from '../TraitListPage';
import { renderListPage } from '../../../../testUtils/renderWithProviders';

type TraitType = {
  id: string;
  slug: string;
  name: string;
  category: string;
  unit?: string | null;
  dataType: 'NUMERIC' | 'CATEGORICAL';
  description: string;
  allowedValues: string[] | null;
  rangeMin: number | null;
  rangeMax: number | null;
};

const taxonomyMocks = vi.hoisted(() => {
  const baseTraits: TraitType[] = [
    {
      id: 'trait-1',
      slug: 'body-length',
      name: 'Lunghezza corpo',
      category: 'Morfologia',
      unit: 'cm',
      dataType: 'NUMERIC',
      description: 'Lunghezza media dal muso alla base della coda per individui adulti.',
      allowedValues: null,
      rangeMin: 5,
      rangeMax: 300,
    },
    {
      id: 'trait-2',
      slug: 'body-mass',
      name: 'Massa corporea',
      category: 'Morfologia',
      unit: 'kg',
      dataType: 'NUMERIC',
      description: 'Peso medio degli adulti in condizioni ottimali.',
      allowedValues: null,
      rangeMin: 0.05,
      rangeMax: 400,
    },
    {
      id: 'trait-3',
      slug: 'diet',
      name: 'Dieta prevalente',
      category: 'Ecologia',
      dataType: 'CATEGORICAL',
      description: 'Categoria alimentare prevalente osservata in natura.',
      allowedValues: ['Erbivoro', 'Carnivoro', 'Onnivoro', 'Insettivoro', 'Piscivoro'],
      rangeMin: null,
      rangeMax: null,
    },
  ];

  const traits: TraitType[] = baseTraits.map((trait) => ({ ...trait }));

  const listTraits = vi.fn(async () => ({
    items: traits.map((trait) => ({ ...trait })),
    page: 0,
    pageSize: 25,
    total: traits.length,
  }));

  const createTrait = vi.fn(async (payload: Omit<TraitType, 'id'>) => {
    const next = { id: `trait-${traits.length + 1}`, ...payload } satisfies TraitType;
    traits.push({ ...next });
    return next;
  });

  const updateTrait = vi.fn(async (id: string, payload: Partial<TraitType>) => {
    const index = traits.findIndex((trait) => trait.id === id);
    if (index >= 0) {
      traits[index] = { ...traits[index], ...payload };
    }
    return traits[index];
  });

  const deleteTrait = vi.fn(async (id: string) => {
    const index = traits.findIndex((trait) => trait.id === id);
    if (index >= 0) {
      traits.splice(index, 1);
    }
  });

  const reset = () => {
    traits.splice(0, traits.length, ...baseTraits.map((trait) => ({ ...trait })));
    listTraits.mockClear();
    createTrait.mockClear();
    updateTrait.mockClear();
    deleteTrait.mockClear();
  };

  return {
    baseTraits,
    traits,
    listTraits,
    createTrait,
    updateTrait,
    deleteTrait,
    reset,
  };
});

vi.mock('../../../../lib/taxonomy', () => ({
  listTraits: taxonomyMocks.listTraits,
  createTrait: taxonomyMocks.createTrait,
  updateTrait: taxonomyMocks.updateTrait,
  deleteTrait: taxonomyMocks.deleteTrait,
}));

function renderPage() {
  const user = userEvent.setup();
  const result = renderListPage(<TraitListPage />);
  return { user, result };
}

describe('TraitListPage', () => {
  beforeEach(() => {
    taxonomyMocks.reset();
  });

  it(
    'allows creating, editing and deleting traits',
    { timeout: 15000 },
    async () => {
    const { user } = renderPage();

    await waitFor(() => expect(taxonomyMocks.listTraits).toHaveBeenCalledTimes(1));
    await screen.findByText('Lunghezza corpo');

    await user.click(screen.getByRole('button', { name: /nuovo trait/i }));
    const createDialog = await screen.findByRole('dialog');
    const dialog = within(createDialog);
    const slugField = await dialog.findByLabelText(/slug/i);
    await user.type(slugField, 'tolleranza-sale');
    const nameField = await dialog.findByLabelText(/nome/i, { selector: 'input' });
    await user.type(nameField, 'Tolleranza al sale');
    await user.type(dialog.getByLabelText(/categoria/i), 'Fisiologia');
    await user.click(dialog.getByLabelText(/tipo dato/i));
    await user.click(screen.getByRole('option', { name: 'Numerico' }));
    await user.type(dialog.getByLabelText(/unità/i), 'ppt');
    await user.type(dialog.getByLabelText(/descrizione/i), 'Concentrazione salina massima tollerata.');
    await user.type(dialog.getByLabelText(/valore minimo/i), '0');
    await user.type(dialog.getByLabelText(/valore massimo/i), '20');
    await user.click(screen.getByRole('button', { name: /salva$/i }));

    await screen.findByText('Trait creato con successo.');
    await waitFor(() => expect(taxonomyMocks.listTraits).toHaveBeenCalledTimes(2));
    expect(taxonomyMocks.createTrait).toHaveBeenCalledWith({
      slug: 'tolleranza-sale',
      name: 'Tolleranza al sale',
      category: 'Fisiologia',
      dataType: 'NUMERIC',
      unit: 'ppt',
      description: 'Concentrazione salina massima tollerata.',
      allowedValues: undefined,
      rangeMin: 0,
      rangeMax: 20,
    });
    await screen.findByText('Tolleranza al sale');

    const dietRow = screen.getByText('Dieta prevalente').closest('tr');
    if (!dietRow) throw new Error('Row not found');
    const dietActions = await within(dietRow).findByRole('button', { name: /azioni/i });
    await user.click(dietActions);
    await user.click(await screen.findByRole('menuitem', { name: /modifica/i }));
    const allowedField = await screen.findByLabelText('Valori consentiti');
    await user.clear(allowedField);
    await user.type(allowedField, 'Erbivoro, Carnivoro, Onnivoro, Insettivoro, Piscivoro, Frugivoro');
    await user.click(screen.getByRole('button', { name: /salva modifiche/i }));

    await screen.findByText('Trait aggiornato con successo.');
    await waitFor(() => expect(taxonomyMocks.listTraits).toHaveBeenCalledTimes(3));
    expect(taxonomyMocks.updateTrait).toHaveBeenCalledWith('trait-3', {
      slug: 'diet',
      name: 'Dieta prevalente',
      category: 'Ecologia',
      dataType: 'CATEGORICAL',
      unit: undefined,
      description: 'Categoria alimentare prevalente osservata in natura.',
      allowedValues: ['Erbivoro', 'Carnivoro', 'Onnivoro', 'Insettivoro', 'Piscivoro', 'Frugivoro'],
      rangeMin: null,
      rangeMax: null,
    });

    const massRow = screen.getByText('Massa corporea').closest('tr');
    if (!massRow) throw new Error('Row not found');
    const massActions = await within(massRow).findByRole('button', { name: /azioni/i });
    await user.click(massActions);
    await user.click(await screen.findByRole('menuitem', { name: /elimina/i }));
    await user.click(screen.getByRole('button', { name: /^elimina$/i }));

    await screen.findByText('Trait eliminato con successo.', undefined, { timeout: 10000 });
    await waitFor(() => expect(taxonomyMocks.listTraits).toHaveBeenCalledTimes(4));
    expect(taxonomyMocks.deleteTrait).toHaveBeenCalledWith('trait-2');
    await waitFor(() => expect(screen.queryByText('Massa corporea')).not.toBeInTheDocument());
  });
});

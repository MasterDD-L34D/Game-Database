import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { vi } from 'vitest';
import TraitListPage from '../TraitListPage';
import { SnackbarProvider } from '../../../../components/SnackbarProvider';
import { SearchProvider } from '../../../../providers/SearchProvider';

const baseTraits = [
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

const traits = baseTraits.map((trait) => ({ ...trait }));

const listTraits = vi.fn(async () => ({
  items: traits.map((trait) => ({ ...trait })),
  page: 0,
  pageSize: 25,
  total: traits.length,
}));

const createTrait = vi.fn(async (payload: any) => {
  const next = { id: `trait-${traits.length + 1}`, ...payload } as typeof traits[number];
  traits.push({ ...next });
  return next;
});

const updateTrait = vi.fn(async (id: string, payload: Partial<typeof traits[number]>) => {
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

vi.mock('../../../../lib/taxonomy', () => ({
  listTraits,
  createTrait,
  updateTrait,
  deleteTrait,
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const user = userEvent.setup();
  const theme = createTheme();
  render(
    <QueryClientProvider client={queryClient}>
      <SearchProvider>
        <ThemeProvider theme={theme}>
          <SnackbarProvider>
            <TraitListPage />
          </SnackbarProvider>
        </ThemeProvider>
      </SearchProvider>
    </QueryClientProvider>,
  );
  return user;
}

describe('TraitListPage', () => {
  beforeEach(() => {
    traits.splice(0, traits.length, ...baseTraits.map((trait) => ({ ...trait })));
    listTraits.mockClear();
    createTrait.mockClear();
    updateTrait.mockClear();
    deleteTrait.mockClear();
  });

  it('allows creating, editing and deleting traits', async () => {
    const user = renderPage();

    await screen.findByText('Lunghezza corpo');
    expect(listTraits).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: /nuovo trait/i }));
    await user.type(screen.getByLabelText('Slug'), 'tolleranza-sale');
    await user.type(screen.getByLabelText('Nome'), 'Tolleranza al sale');
    await user.type(screen.getByLabelText('Categoria'), 'Fisiologia');
    await user.click(screen.getByLabelText('Tipo dato'));
    await user.click(screen.getByRole('option', { name: 'Numerico' }));
    await user.type(screen.getByLabelText('Unità'), 'ppt');
    await user.type(screen.getByLabelText('Descrizione'), 'Concentrazione salina massima tollerata.');
    await user.type(screen.getByLabelText('Valore minimo'), '0');
    await user.type(screen.getByLabelText('Valore massimo'), '20');
    await user.click(screen.getByRole('button', { name: /salva$/i }));

    await screen.findByText('Trait creato con successo.');
    await waitFor(() => expect(listTraits).toHaveBeenCalledTimes(2));
    expect(createTrait).toHaveBeenCalledWith({
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
    await user.click(within(dietRow).getByRole('button', { name: /azioni/i }));
    await user.click(await screen.findByRole('menuitem', { name: /modifica/i }));
    const allowedField = await screen.findByLabelText('Valori consentiti');
    await user.clear(allowedField);
    await user.type(allowedField, 'Erbivoro, Carnivoro, Onnivoro, Insettivoro, Piscivoro, Frugivoro');
    await user.click(screen.getByRole('button', { name: /salva modifiche/i }));

    await screen.findByText('Trait aggiornato con successo.');
    await waitFor(() => expect(listTraits).toHaveBeenCalledTimes(3));
    expect(updateTrait).toHaveBeenCalledWith('trait-3', {
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
    await user.click(within(massRow).getByRole('button', { name: /azioni/i }));
    await user.click(await screen.findByRole('menuitem', { name: /elimina/i }));
    await user.click(screen.getByRole('button', { name: /^elimina$/i }));

    await screen.findByText('Trait eliminato con successo.');
    await waitFor(() => expect(listTraits).toHaveBeenCalledTimes(4));
    expect(deleteTrait).toHaveBeenCalledWith('trait-2');
    await waitFor(() => expect(screen.queryByText('Massa corporea')).not.toBeInTheDocument());
  });
});

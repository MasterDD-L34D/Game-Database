import type { ColumnDef } from '@tanstack/react-table';
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderListPage, userEvent } from '../../testUtils/renderWithProviders';

type Item = { id: string; name: string };

const columns: ColumnDef<Item, any>[] = [
  { accessorKey: 'name', header: 'Nome', cell: (info) => info.getValue() },
];

function makeFetcher(items: Item[]) {
  return vi
    .fn<(q: string, p?: number, ps?: number) => Promise<{ items: Item[]; total: number; page: number; pageSize: number }>>()
    .mockResolvedValue({ items, total: items.length, page: 0, pageSize: 25 });
}

const baseItems: Item[] = [
  { id: '1', name: 'Alpha' },
  { id: '2', name: 'Beta' },
  { id: '3', name: 'Gamma' },
];

function renderBulk(deleteFn = vi.fn().mockResolvedValue(undefined), fetcher = makeFetcher(baseItems)) {
  renderListPage<Item>({
    title: 'Elementi',
    columns,
    fetcher,
    queryKeyBase: ['bulk-items'],
    autoloadOnMount: true,
    deleteConfig: {
      dialogTitle: 'Elimina',
      mutation: async (item) => {
        await deleteFn(item);
      },
      successMessage: 'Eliminato',
    },
    bulkConfig: { enableDelete: true },
    getItemLabel: (item) => item.name,
  });
  return { deleteFn, fetcher };
}

describe('ListPage bulk selection', () => {
  it('renders row checkboxes only when bulkConfig is present', async () => {
    renderBulk();
    await waitFor(() => expect(screen.getByText('Alpha')).toBeInTheDocument());
    expect(screen.getByRole('checkbox', { name: 'Seleziona tutte le righe' })).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox', { name: 'Seleziona riga' })).toHaveLength(3);
  });

  it('shows the bulk toolbar with count when rows selected, hidden at zero', async () => {
    renderBulk();
    await waitFor(() => expect(screen.getByText('Alpha')).toBeInTheDocument());

    // Hidden initially
    expect(screen.queryByText(/selezionati/i)).not.toBeInTheDocument();

    const user = userEvent.setup();
    const rowChecks = screen.getAllByRole('checkbox', { name: 'Seleziona riga' });
    await user.click(rowChecks[0]);
    await user.click(rowChecks[1]);

    expect(await screen.findByText('2 selezionati')).toBeInTheDocument();

    // Deselect all clears it
    await user.click(screen.getByRole('button', { name: 'Deseleziona tutto' }));
    await waitFor(() => expect(screen.queryByText(/selezionati/i)).not.toBeInTheDocument());
  });

  it('clears selection when the search query changes', async () => {
    renderBulk();
    await waitFor(() => expect(screen.getByText('Alpha')).toBeInTheDocument());

    const user = userEvent.setup();
    await user.click(screen.getAllByRole('checkbox', { name: 'Seleziona riga' })[0]);
    expect(await screen.findByText('1 selezionati')).toBeInTheDocument();

    // Typing a query + Enter changes criteria -> selection must clear
    const searchBox = screen.getByPlaceholderText('Cerca');
    await user.type(searchBox, 'Alpha{Enter}');

    await waitFor(() => expect(screen.queryByText(/selezionati/i)).not.toBeInTheDocument());
  });
});

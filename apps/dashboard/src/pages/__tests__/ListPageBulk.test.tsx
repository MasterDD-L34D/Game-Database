import type { ColumnDef } from '@tanstack/react-table';
import { screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { renderListPage, userEvent } from '../../testUtils/renderWithProviders';

type Item = { id: string; name: string };

type EditItem = { id: string; name: string; category: string };

function renderBulkEdit(editFn = vi.fn().mockResolvedValue(undefined)) {
  const items: EditItem[] = [
    { id: '1', name: 'Alpha', category: 'X' },
    { id: '2', name: 'Beta', category: 'Y' },
  ];
  const fetcher = vi
    .fn<(q: string, p?: number, ps?: number) => Promise<{ items: EditItem[]; total: number; page: number; pageSize: number }>>()
    .mockResolvedValue({ items, total: items.length, page: 0, pageSize: 25 });
  renderListPage<EditItem>({
    title: 'Elementi',
    columns: [{ accessorKey: 'name', header: 'Nome', cell: (info) => info.getValue() }],
    fetcher,
    queryKeyBase: ['bulk-edit-items'],
    autoloadOnMount: true,
    editConfig: {
      dialogTitle: 'Modifica',
      fields: [
        { name: 'name', label: 'Nome', required: true },
        { name: 'category', label: 'Categoria', bulkEditable: true },
      ],
      schema: z.object({ name: z.string().min(1), category: z.string() }),
      getInitialValues: (item) => ({ name: item.name, category: item.category }),
      onSubmit: async (item, values) => {
        await editFn(item, values);
      },
      successMessage: 'Aggiornato',
    },
    bulkConfig: { enableEdit: true },
    getItemLabel: (item) => item.name,
  });
  return { editFn, fetcher };
}

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

  it('bulk-deletes all selected rows and refreshes', async () => {
    const deleteFn = vi.fn().mockResolvedValue(undefined);
    const fetcher = makeFetcher(baseItems);
    renderBulk(deleteFn, fetcher);
    await screen.findByText('Alpha');
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));

    const user = userEvent.setup();
    await user.click(screen.getByRole('checkbox', { name: 'Seleziona tutte le righe' }));
    await screen.findByText('3 selezionati');

    await user.click(screen.getByRole('button', { name: 'Elimina 3' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Alpha')).toBeInTheDocument();
    // Confirm
    await user.click(within(dialog).getByRole('button', { name: 'Elimina 3' }));

    await waitFor(() => expect(deleteFn).toHaveBeenCalledTimes(3));
    await screen.findByText('3 elementi eliminati.');
    // Refresh triggered (invalidate -> refetch)
    await waitFor(() => expect(fetcher.mock.calls.length).toBeGreaterThanOrEqual(2));
    // Selection cleared
    await waitFor(() => expect(screen.queryByText(/selezionati/i)).not.toBeInTheDocument());
  });

  it('reports partial-failure counts when some deletes reject', async () => {
    const deleteFn = vi
      .fn()
      .mockResolvedValueOnce(undefined) // id 1 ok
      .mockRejectedValueOnce(new Error('boom')) // id 2 fail
      .mockResolvedValueOnce(undefined); // id 3 ok
    const fetcher = makeFetcher(baseItems);
    renderBulk(deleteFn, fetcher);
    await screen.findByText('Alpha');
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));

    const user = userEvent.setup();
    await user.click(screen.getByRole('checkbox', { name: 'Seleziona tutte le righe' }));
    await screen.findByText('3 selezionati');
    await user.click(screen.getByRole('button', { name: 'Elimina 3' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Elimina 3' }));

    await waitFor(() => expect(deleteFn).toHaveBeenCalledTimes(3));
    await screen.findByText('2 eliminati, 1 falliti.');
  });

  it('shows the bulk-edit button only when a bulkEditable field exists', async () => {
    renderBulkEdit();
    await screen.findByText('Alpha');
    const user = userEvent.setup();
    await user.click(screen.getByRole('checkbox', { name: 'Seleziona tutte le righe' }));
    await screen.findByText('2 selezionati');
    expect(screen.getByRole('button', { name: 'Modifica 2' })).toBeInTheDocument();
  });

  it('bulk-edits the chosen field across selected rows with full per-row payload', async () => {
    const editFn = vi.fn().mockResolvedValue(undefined);
    renderBulkEdit(editFn);
    await screen.findByText('Alpha');
    const user = userEvent.setup();
    await user.click(screen.getByRole('checkbox', { name: 'Seleziona tutte le righe' }));
    await screen.findByText('2 selezionati');
    await user.click(screen.getByRole('button', { name: 'Modifica 2' }));

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByLabelText('Campo da modificare'));
    await user.click(await screen.findByRole('option', { name: 'Categoria' }));
    await user.type(within(dialog).getByLabelText('Nuovo valore'), 'Z');
    await user.click(within(dialog).getByRole('button', { name: 'Applica a 2' }));

    await waitFor(() => expect(editFn).toHaveBeenCalledTimes(2));
    expect(editFn).toHaveBeenCalledWith(
      expect.objectContaining({ id: '1' }),
      { name: 'Alpha', category: 'Z' },
    );
    expect(editFn).toHaveBeenCalledWith(
      expect.objectContaining({ id: '2' }),
      { name: 'Beta', category: 'Z' },
    );
    await screen.findByText('2 elementi aggiornati.');
  });

  it('does not co-toggle distinct rows that lack an id (unique fallback keys)', async () => {
    // Regression for Codex PR #145 P2: getRowId `row.id ?? ''` collapsed all
    // id-less rows to one selection key, so selecting one toggled all of them.
    const noIdItems = [{ name: 'NoId Uno' }, { name: 'NoId Due' }] as unknown as Item[];
    const fetcher = makeFetcher(noIdItems);
    renderBulk(vi.fn().mockResolvedValue(undefined), fetcher);
    await screen.findByText('NoId Uno');

    const user = userEvent.setup();
    const rowChecks = screen.getAllByRole('checkbox', { name: 'Seleziona riga' });
    await user.click(rowChecks[0]);

    // Only one row toggled, and it surfaces in selectedItems (toolbar count = 1)
    expect(await screen.findByText('1 selezionati')).toBeInTheDocument();
    await waitFor(() => {
      const checked = screen
        .getAllByRole('checkbox', { name: 'Seleziona riga' })
        .filter((cb) => (cb as HTMLInputElement).checked);
      expect(checked).toHaveLength(1);
    });
  });
});

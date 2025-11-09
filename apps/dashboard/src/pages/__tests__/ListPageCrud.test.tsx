import type { ColumnDef } from '@tanstack/react-table';
import { screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderListPage, userEvent } from '../../testUtils/renderWithProviders';

type Item = { id: string; name: string; description?: string };

const columns: ColumnDef<Item, any>[] = [
  {
    accessorKey: 'name',
    header: 'Nome',
    cell: (info) => info.getValue(),
  },
];

describe('ListPage CRUD actions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows creating, editing and deleting items with automatic refresh', async () => {
    const fetcher = vi
      .fn<(query: string, page?: number, pageSize?: number) => Promise<{ items: Item[]; total: number; page: number; pageSize: number }>>()
      .mockResolvedValue({ items: [{ id: '1', name: 'Item Uno', description: 'Desc' }], total: 1, page: 0, pageSize: 25 });
    const createFn = vi.fn().mockResolvedValue(undefined);
    const updateFn = vi.fn().mockResolvedValue(undefined);
    const deleteFn = vi.fn().mockResolvedValue(undefined);

    const user = userEvent.setup();

    renderListPage<Item>({
      title: 'Elementi',
      columns,
      fetcher,
      queryKeyBase: ['items'],
      autoloadOnMount: true,
      createConfig: {
        triggerLabel: 'Nuovo elemento',
        dialogTitle: 'Crea elemento',
        submitLabel: 'Salva nuovo',
        defaultValues: { name: '', description: '' },
        fields: [
          { name: 'name', label: 'Nome', required: true },
          { name: 'description', label: 'Descrizione', type: 'textarea' },
        ],
        mutation: async (values) => {
          await createFn(values);
        },
        successMessage: 'Elemento creato',
        errorMessage: 'Errore creazione',
      },
      editConfig: {
        dialogTitle: 'Modifica elemento',
        submitLabel: 'Salva modifiche',
        fields: [
          { name: 'name', label: 'Nome', required: true },
          { name: 'description', label: 'Descrizione', type: 'textarea' },
        ],
        getInitialValues: (item) => ({ name: item.name, description: item.description ?? '' }),
        mutation: async (item, values) => {
          await updateFn(item, values);
        },
        successMessage: 'Elemento aggiornato',
        errorMessage: 'Errore aggiornamento',
      },
      deleteConfig: {
        dialogTitle: 'Elimina elemento',
        description: (item) => `Confermi eliminazione di ${item.name}?`,
        mutation: async (item) => {
          await deleteFn(item);
        },
        successMessage: 'Elemento eliminato',
        errorMessage: 'Errore eliminazione',
      },
      getItemLabel: (item) => item.name,
    });

    await waitFor(() => {
      expect(fetcher).toHaveBeenCalledTimes(1);
    });

    await user.click(screen.getByRole('button', { name: 'Nuovo elemento' }));
    const nameInput = await screen.findByLabelText('Nome');
    await user.type(nameInput, 'Nuovo elemento');
    await user.click(screen.getByRole('button', { name: 'Salva nuovo' }));

    await waitFor(() => {
      expect(createFn).toHaveBeenCalledWith(expect.objectContaining({ name: 'Nuovo elemento' }));
    });
    await screen.findByText('Elemento creato');
    await waitFor(() => {
      expect(fetcher).toHaveBeenCalledTimes(2);
    });

    await user.click(screen.getByLabelText('Azioni'));
    const menu = await screen.findByRole('menu');
    await user.click(within(menu).getByRole('menuitem', { name: 'Modifica' }));

    const editNameInput = await screen.findByLabelText('Nome');
    await user.clear(editNameInput);
    await user.type(editNameInput, 'Elemento aggiornato');
    await user.click(screen.getByRole('button', { name: 'Salva modifiche' }));

    await waitFor(() => {
      expect(updateFn).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }), expect.objectContaining({ name: 'Elemento aggiornato' }));
    });
    await screen.findByText('Elemento aggiornato');
    await waitFor(() => {
      expect(fetcher).toHaveBeenCalledTimes(3);
    });

    await user.click(screen.getByLabelText('Azioni'));
    const deleteMenu = await screen.findByRole('menu');
    await user.click(within(deleteMenu).getByRole('menuitem', { name: 'Elimina' }));

    await screen.findByText('Confermi eliminazione di Item Uno?');
    await user.click(screen.getByRole('button', { name: 'Elimina' }));

    await waitFor(() => {
      expect(deleteFn).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }));
    });
    await screen.findByText('Elemento eliminato');
    await waitFor(() => {
      expect(fetcher).toHaveBeenCalledTimes(4);
    });
  });
});

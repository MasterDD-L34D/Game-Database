import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ColumnDef, PaginationState } from '@tanstack/react-table';
import { describe, expect, it, vi } from 'vitest';
import DataTable from '../DataTable';

type TestRow = { id: string; name: string; value: number };

const columns: ColumnDef<TestRow>[] = [
  {
    accessorKey: 'name',
    header: 'Nome',
    cell: (info) => info.getValue(),
    enableSorting: true,
  },
  {
    accessorKey: 'value',
    header: 'Valore',
    cell: (info) => info.getValue(),
  },
];

const data: TestRow[] = [
  { id: '1', name: 'Alpha', value: 10 },
  { id: '2', name: 'Beta', value: 20 },
  { id: '3', name: 'Gamma', value: 30 },
];

describe('DataTable', () => {
  it('invokes onSortingChange when clicking on a sortable header', async () => {
    const onSortingChange = vi.fn();

    render(
      <DataTable<TestRow>
        data={data}
        columns={columns}
        onSortingChange={onSortingChange}
        totalCount={data.length}
      />,
    );

    const header = screen.getByRole('columnheader', { name: /Nome/i });
    fireEvent.click(header);

    await waitFor(() => {
      expect(onSortingChange).toHaveBeenCalledWith([{ id: 'name', desc: false }]);
    });
  });

  it('invokes onPaginationChange with the next page', async () => {
    const onPaginationChange = vi.fn<(pagination: PaginationState) => void>();

    render(
      <DataTable<TestRow>
        data={data}
        columns={columns}
        onPaginationChange={onPaginationChange}
        totalCount={20}
      />,
    );

    const nextButton = screen.getByLabelText('Go to next page');
    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(onPaginationChange).toHaveBeenCalledWith({ pageIndex: 1, pageSize: 10 });
    });
  });

  it('invokes onPaginationChange when changing rows per page', async () => {
    const onPaginationChange = vi.fn<(pagination: PaginationState) => void>();

    render(
      <DataTable<TestRow>
        data={data}
        columns={columns}
        onPaginationChange={onPaginationChange}
        totalCount={20}
        pageSizeOptions={[5, 10]}
      />,
    );

    const user = userEvent.setup();
    const rowsPerPageSelect = screen.getByRole('combobox', { name: /righe per pagina/i });
    await user.click(rowsPerPageSelect);
    const option = await screen.findByRole('option', { name: '10' });
    await user.click(option);

    await waitFor(() => {
      expect(onPaginationChange).toHaveBeenCalledWith({ pageIndex: 0, pageSize: 10 });
    });
  });
});

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PaginationState } from '@tanstack/react-table';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SnackbarProvider } from '../../../../components/SnackbarProvider';
import type { RecordRow } from '../../../../types/record';
import RecordTable from '../RecordTable';

const dataTableMock = vi.fn();

vi.mock('../../../../components/data-table/DataTable', () => ({
  __esModule: true,
  default: (props: {
    onPaginationChange?: (pagination: PaginationState) => void;
    onSortingChange?: (sorting: { id: string; desc: boolean }[]) => void;
  }) => {
    dataTableMock(props);
    return (
      <div data-testid="data-table">
        <button type="button" onClick={() => props.onPaginationChange?.({ pageIndex: 1, pageSize: 10 })}>
          change page
        </button>
        <button type="button" onClick={() => props.onSortingChange?.([{ id: 'nome', desc: false }])}>
          change sort
        </button>
      </div>
    );
  },
}));

vi.mock('../../api/useDeleteRecordsMutation', () => ({
  useDeleteRecordsMutation: () => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

describe('RecordTable', () => {
  beforeEach(() => {
    dataTableMock.mockClear();
    localStorage.clear();
  });

  it('passes pagination, total and sort handlers to DataTable', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const data: RecordRow[] = [
      { id: '1', nome: 'Record Uno', stato: 'Attivo' },
    ];
    const pagination: PaginationState = { pageIndex: 2, pageSize: 25 };
    const handlePaginationChange = vi.fn();
    const handleSortChange = vi.fn();

    render(
      <QueryClientProvider client={queryClient}>
        <SnackbarProvider>
          <RecordTable
            data={data}
            total={100}
            loading={false}
            pagination={pagination}
            onPaginationChange={handlePaginationChange}
            onSortingChange={handleSortChange}
          />
        </SnackbarProvider>
      </QueryClientProvider>,
    );

    expect(dataTableMock).toHaveBeenCalled();
    const props = dataTableMock.mock.calls.at(-1)?.[0] as {
      pagination?: PaginationState;
      onPaginationChange?: typeof handlePaginationChange;
      totalCount?: number;
      onSortingChange?: typeof handleSortChange;
    };
    expect(props.pagination).toBe(pagination);
    expect(props.onPaginationChange).toBe(handlePaginationChange);
    expect(props.totalCount).toBe(100);
    expect(props.onSortingChange).toBe(handleSortChange);
  });

  it('calls pagination handler when DataTable triggers a pagination change', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const data: RecordRow[] = [
      { id: '1', nome: 'Record Uno', stato: 'Attivo' },
    ];
    const pagination: PaginationState = { pageIndex: 0, pageSize: 10 };
    const handlePaginationChange = vi.fn();

    render(
      <QueryClientProvider client={queryClient}>
        <SnackbarProvider>
          <RecordTable
            data={data}
            total={100}
            loading={false}
            pagination={pagination}
            onPaginationChange={handlePaginationChange}
            onSortingChange={vi.fn()}
          />
        </SnackbarProvider>
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /change page/i }));

    expect(handlePaginationChange).toHaveBeenCalledWith({ pageIndex: 1, pageSize: 10 });
  });

  it('calls sorting handler when DataTable triggers a sorting change', () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const data: RecordRow[] = [
      { id: '1', nome: 'Record Uno', stato: 'Attivo' },
    ];
    const pagination: PaginationState = { pageIndex: 0, pageSize: 25 };
    const handleSortChange = vi.fn();

    render(
      <QueryClientProvider client={queryClient}>
        <SnackbarProvider>
          <RecordTable
            data={data}
            total={100}
            loading={false}
            pagination={pagination}
            onPaginationChange={vi.fn()}
            onSortingChange={handleSortChange}
          />
        </SnackbarProvider>
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /change sort/i }));

    expect(handleSortChange).toHaveBeenCalledWith([{ id: 'nome', desc: false }]);
  });
});

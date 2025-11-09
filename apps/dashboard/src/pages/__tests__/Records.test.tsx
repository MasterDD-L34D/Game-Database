import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import Records from '../Records';
import { SearchProvider } from '../../providers/SearchProvider';
import { SnackbarProvider } from '../../components/SnackbarProvider';
import type { RecordRow } from '../../types/record';
import * as recordsApi from '../../lib/records';
import { theme } from '../../theme';

const recordTableMock = vi.fn();

vi.mock('../../lib/records', async () => {
  const actual = await vi.importActual<typeof import('../../lib/records')>('../../lib/records');
  return {
    ...actual,
    listRecords: vi.fn(),
  };
});

vi.mock('../../features/records/components/RecordTable', () => ({
  __esModule: true,
  default: (props: {
    data: RecordRow[];
    total: number;
    pagination?: { pageIndex: number; pageSize: number };
    onPaginationChange?: (pagination: { pageIndex: number; pageSize: number }) => void;
    onSortingChange?: (sorting: { id: string; desc: boolean }[]) => void;
  }) => {
    recordTableMock(props);
    return (
      <div>
        <div data-testid="record-table-mock" />
        <button type="button" onClick={() => props.onPaginationChange?.({ pageIndex: 1, pageSize: props.pagination?.pageSize ?? 25 })}>
          pagina successiva
        </button>
        <button type="button" onClick={() => props.onSortingChange?.([{ id: 'nome', desc: false }])}>
          ordina per nome
        </button>
      </div>
    );
  },
}));

const listRecordsMock = recordsApi.listRecords as unknown as Mock;

describe('Records page', () => {
  beforeEach(() => {
    listRecordsMock.mockReset();
    recordTableMock.mockClear();
    listRecordsMock.mockImplementation(async (params: { page: number; pageSize: number }) => ({
      items: [
        { id: '1', nome: `Record pagina ${params.page + 1}`, stato: 'Attivo' } satisfies RecordRow,
      ],
      total: 100,
      page: params.page,
      pageSize: params.pageSize,
    }));
    localStorage.clear();
  });

  function renderPage() {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          refetchOnWindowFocus: false,
          refetchOnReconnect: false,
        },
      },
    });

    return render(
      <QueryClientProvider client={queryClient}>
        <SnackbarProvider>
          <SearchProvider>
            <ThemeProvider theme={theme}>
              <MemoryRouter initialEntries={[{ pathname: '/records' }]}> 
                <Routes>
                  <Route path="/records" element={<Records />} />
                </Routes>
              </MemoryRouter>
            </ThemeProvider>
          </SearchProvider>
        </SnackbarProvider>
      </QueryClientProvider>,
    );
  }

  it('fetches data on init and refetches on pagination and sorting changes', async () => {
    renderPage();

    await waitFor(() => {
      expect(listRecordsMock).toHaveBeenCalledTimes(1);
    });

    expect(listRecordsMock.mock.calls.at(-1)?.[0]).toMatchObject({ page: 0, pageSize: 25 });

    await waitFor(() => {
      expect(recordTableMock).toHaveBeenCalledWith(
        expect.objectContaining({ total: 100, data: expect.any(Array), loading: false }),
      );
    });

    fireEvent.click(screen.getByRole('button', { name: /pagina successiva/i }));

    await waitFor(() => {
      expect(listRecordsMock).toHaveBeenCalledTimes(2);
    });

    expect(listRecordsMock.mock.calls.at(-1)?.[0]).toMatchObject({ page: 1, pageSize: 25 });

    fireEvent.click(screen.getByRole('button', { name: /ordina per nome/i }));

    await waitFor(() => {
      expect(listRecordsMock).toHaveBeenCalledTimes(4);
    });

    expect(listRecordsMock.mock.calls.at(-1)?.[0]).toMatchObject({ page: 0, sort: 'nome:asc' });
  });

  it('resets the current page when search changes', async () => {
    renderPage();

    await waitFor(() => {
      expect(listRecordsMock).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: /pagina successiva/i }));

    await waitFor(() => {
      expect(listRecordsMock).toHaveBeenCalledTimes(2);
    });

    expect(listRecordsMock.mock.calls.at(-1)?.[0]).toMatchObject({ page: 1, pageSize: 25 });

    const searchInput = screen.getByPlaceholderText(/cerca/i);

    fireEvent.change(searchInput, { target: { value: 'nuovo filtro' } });
    fireEvent.blur(searchInput);

    await waitFor(() => {
      expect(listRecordsMock).toHaveBeenCalledTimes(4);
    });

    expect(listRecordsMock.mock.calls.at(-1)?.[0]).toMatchObject({ page: 0, q: 'nuovo filtro' });
  });
});

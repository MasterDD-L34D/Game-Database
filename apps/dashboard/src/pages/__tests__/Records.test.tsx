import { fireEvent, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import Records from '../Records';
import type { RecordRow } from '../../types/record';
import * as recordsApi from '../../lib/records';
import { renderWithProviders } from '../../testUtils/renderWithProviders';

const recordTableMock = vi.fn();
const exportMenuMock = vi.fn();

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

vi.mock('../../components/ExportMenu', () => ({
  __esModule: true,
  default: (props: any) => {
    exportMenuMock(props);
    return <div data-testid="export-menu-mock" />;
  },
}));

const listRecordsMock = recordsApi.listRecords as unknown as Mock;

describe('Records page', () => {
  beforeEach(() => {
    listRecordsMock.mockReset();
    recordTableMock.mockClear();
    exportMenuMock.mockClear();
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
    const router = createMemoryRouter([
      {
        path: '/records',
        element: <Records />,
      },
    ], {
      initialEntries: ['/records'],
    });

    return renderWithProviders(<Records />, { router });
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

    await waitFor(() => {
      expect(exportMenuMock).toHaveBeenCalled();
    });
    const serverQuery = exportMenuMock.mock.calls.at(-1)?.[0]?.serverQuery as string | undefined;
    expect(serverQuery).toBeDefined();
    expect(serverQuery).toContain('sort=nome%3Aasc');
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

  it('falls back to default filters when stored filters are invalid JSON', async () => {
    localStorage.setItem('records-filters-v1', 'not json');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      renderPage();

      const searchInput = await screen.findByPlaceholderText(/cerca/i);
      expect(searchInput).toHaveValue('');

      await waitFor(() => {
        expect(listRecordsMock).toHaveBeenCalledWith(
          expect.objectContaining({ page: 0, pageSize: 25 }),
        );
      });

      await waitFor(() => {
        expect(warnSpy).toHaveBeenCalled();
      });
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('shows an error message and allows retrying the fetch', async () => {
    listRecordsMock.mockImplementationOnce(async () => {
      throw new Error('Errore di rete');
    });

    renderPage();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Errore di rete');

    const retryButton = screen.getByRole('button', { name: /riprova/i });
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(listRecordsMock).toHaveBeenCalledTimes(2);
    });

    await waitFor(() => {
      expect(recordTableMock).toHaveBeenCalledWith(
        expect.objectContaining({ loading: false, data: expect.any(Array) }),
      );
    });
  });
});

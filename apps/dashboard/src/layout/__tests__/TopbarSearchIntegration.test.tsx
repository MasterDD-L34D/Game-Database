import type { ColumnDef } from '@tanstack/react-table';
import { waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ListPage from '../../pages/ListPage';
import Topbar from '../Topbar';
import { SEARCH_DEBOUNCE_DELAY } from '../../providers/SearchProvider';
import { createMemoryRouter, renderWithProviders } from '../../testUtils/renderWithProviders';

type Item = { id: string; name: string };

const columns: ColumnDef<Item, any>[] = [
  {
    accessorKey: 'name',
    header: 'Nome',
    cell: (info) => info.getValue(),
  },
];

describe('Topbar search integration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('propagates the debounced query to list pages', async () => {
    const fetcher = vi.fn().mockResolvedValue({ items: [] as Item[], total: 0, page: 0, pageSize: 25 });
    const user = userEvent.setup({ advanceTimers: async (ms) => vi.advanceTimersByTimeAsync(ms ?? 0) });

    const router = createMemoryRouter([
      {
        path: '/',
        element: (
          <>
            <Topbar />
            <div className="p-4">
              <ListPage<Item>
                title="Specie"
                columns={columns}
                fetcher={fetcher}
                queryKeyBase={['items']}
                autoloadOnMount
              />
            </div>
          </>
        ),
      },
    ]);

    const { getAllByPlaceholderText } = renderWithProviders(<div />, { router });

    await waitFor(() => {
      expect(fetcher).toHaveBeenCalled();
    });

    fetcher.mockClear();

    const [topbarInput] = getAllByPlaceholderText('Cerca');
    await user.type(topbarInput, 'lince');
    await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_DELAY);

    await waitFor(() => {
      expect(fetcher).toHaveBeenCalledWith('lince', 0, 25);
    });
  });
});

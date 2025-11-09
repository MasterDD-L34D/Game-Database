import type { ColumnDef } from '@tanstack/react-table';
import { act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ListPage from '../../pages/ListPage';
import Topbar from '../Topbar';
import { SEARCH_DEBOUNCE_DELAY } from '../../providers/SearchProvider';
import { renderWithProviders } from '../../testUtils/renderWithProviders';

type Item = { id: string; name: string };

const columns: ColumnDef<Item, any>[] = [
  {
    accessorKey: 'name',
    header: 'Nome',
    cell: (info) => info.getValue(),
  },
];

describe('Topbar search integration', () => {
  it(
    'propagates the debounced query to list pages',
    { timeout: 15000 },
    async () => {
      const fetcher = vi.fn().mockResolvedValue({ items: [] as Item[], total: 0, page: 0, pageSize: 25 });
      const user = userEvent.setup();

      const { getAllByPlaceholderText } = renderWithProviders(<div />, {
        router: {
          routes: [
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
          ],
        },
      });

      await waitFor(() => {
        expect(fetcher).toHaveBeenCalled();
      });

      fetcher.mockClear();

      const [topbarInput] = getAllByPlaceholderText('Cerca');
      await user.type(topbarInput, 'lince');
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, SEARCH_DEBOUNCE_DELAY + 50));
      });

      await waitFor(() => {
        expect(fetcher).toHaveBeenCalledWith('lince', 0, 25);
      });

    },
  );
});

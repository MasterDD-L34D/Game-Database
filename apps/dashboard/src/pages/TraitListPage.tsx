import { useCallback } from 'react';
import { ColumnDef, createColumnHelper } from '@tanstack/react-table';
import { useSearchParams } from 'react-router-dom';
import ListPage from './ListPage';
import type { Trait } from '../lib/taxonomy';
import { listTraits } from '../lib/taxonomy';

const DEFAULT_PAGE_SIZE = 25;

const h = createColumnHelper<Trait>();
const columns: ColumnDef<Trait, any>[] = [
  h.accessor('name', { header: 'Nome', cell: (i) => i.getValue() }),
  h.accessor('slug', { header: 'Slug', cell: (i) => i.getValue() }),
  h.accessor('category', { header: 'Categoria', cell: (i) => i.getValue() ?? '' }),
  h.accessor('dataType', { header: 'Tipo dato', cell: (i) => i.getValue() }),
  h.accessor('unit', { header: 'Unità', cell: (i) => i.getValue() ?? '' }),
];

function parseNumber(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export default function TraitListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') ?? '';
  const initialPage = parseNumber(searchParams.get('page'), 0);
  const initialPageSize = parseNumber(searchParams.get('pageSize'), DEFAULT_PAGE_SIZE);

  const handleStateChange = useCallback(
    (state: { query: string; page: number; pageSize: number }) => {
      const nextParams = new URLSearchParams();
      if (state.query) nextParams.set('q', state.query);
      if (state.page > 0) nextParams.set('page', String(state.page));
      if (state.pageSize !== DEFAULT_PAGE_SIZE) nextParams.set('pageSize', String(state.pageSize));
      const current = searchParams.toString();
      const next = nextParams.toString();
      if (current === next) return;
      setSearchParams(nextParams, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  return (
    <ListPage<Trait>
      title="Trait"
      columns={columns}
      fetcher={listTraits}
      queryKeyBase={['traits']}
      initialQuery={initialQuery}
      initialPage={initialPage}
      initialPageSize={initialPageSize}
      autoloadOnMount
      onStateChange={handleStateChange}
    />
  );
}

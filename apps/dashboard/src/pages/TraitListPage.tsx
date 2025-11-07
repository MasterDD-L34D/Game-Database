import { useCallback, useMemo } from 'react';
import { ColumnDef, createColumnHelper } from '@tanstack/react-table';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ListPage from './ListPage';
import type { Trait } from '../lib/taxonomy';
import { listTraits } from '../lib/taxonomy';

const DEFAULT_PAGE_SIZE = 25;

const h = createColumnHelper<Trait>();
function parseNumber(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export default function TraitListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useTranslation('taxonomy');
  const initialQuery = searchParams.get('q') ?? '';
  const initialPage = parseNumber(searchParams.get('page'), 0);
  const initialPageSize = parseNumber(searchParams.get('pageSize'), DEFAULT_PAGE_SIZE);

  const columns = useMemo<ColumnDef<Trait, any>[]>(
    () => [
      h.accessor('name', { header: t('traits.columns.name'), cell: (i) => i.getValue() }),
      h.accessor('slug', { header: t('traits.columns.slug'), cell: (i) => i.getValue() }),
      h.accessor('category', { header: t('traits.columns.category'), cell: (i) => i.getValue() ?? '' }),
      h.accessor('dataType', { header: t('traits.columns.dataType'), cell: (i) => i.getValue() }),
      h.accessor('unit', { header: t('traits.columns.unit'), cell: (i) => i.getValue() ?? '' }),
    ],
    [t],
  );

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
      title={t('traits.title')}
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

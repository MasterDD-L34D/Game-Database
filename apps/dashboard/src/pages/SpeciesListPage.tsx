import { useCallback, useMemo } from 'react';
import { ColumnDef, createColumnHelper } from '@tanstack/react-table';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ListPage from './ListPage';
import type { Species } from '../lib/taxonomy';
import { listSpecies } from '../lib/taxonomy';

const DEFAULT_PAGE_SIZE = 25;

const h = createColumnHelper<Species>();
function parseNumber(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export default function SpeciesListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useTranslation('taxonomy');
  const initialQuery = searchParams.get('q') ?? '';
  const initialPage = parseNumber(searchParams.get('page'), 0);
  const initialPageSize = parseNumber(searchParams.get('pageSize'), DEFAULT_PAGE_SIZE);

  const columns = useMemo<ColumnDef<Species, any>[]>(
    () => [
      h.accessor('scientificName', { header: t('species.columns.scientificName'), cell: (i) => i.getValue() }),
      h.accessor('commonName', { header: t('species.columns.commonName'), cell: (i) => i.getValue() ?? '' }),
      h.accessor('family', { header: t('species.columns.family'), cell: (i) => i.getValue() ?? '' }),
      h.accessor('genus', { header: t('species.columns.genus'), cell: (i) => i.getValue() ?? '' }),
      h.accessor('status', { header: t('species.columns.status'), cell: (i) => i.getValue() ?? '' }),
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
    <ListPage<Species>
      title={t('species.title')}
      columns={columns}
      fetcher={listSpecies}
      queryKeyBase={['species']}
      initialQuery={initialQuery}
      initialPage={initialPage}
      initialPageSize={initialPageSize}
      autoloadOnMount
      onStateChange={handleStateChange}
    />
  );
}

import { useCallback, useMemo } from 'react';
import { ColumnDef, createColumnHelper } from '@tanstack/react-table';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ListPage from './ListPage';
import type { Biome } from '../lib/taxonomy';
import { listBiomes } from '../lib/taxonomy';

const DEFAULT_PAGE_SIZE = 25;

const h = createColumnHelper<Biome>();
function parseNumber(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export default function BiomeListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useTranslation('taxonomy');
  const initialQuery = searchParams.get('q') ?? '';
  const initialPage = parseNumber(searchParams.get('page'), 0);
  const initialPageSize = parseNumber(searchParams.get('pageSize'), DEFAULT_PAGE_SIZE);

  const columns = useMemo<ColumnDef<Biome, any>[]>(
    () => [
      h.accessor('name', { header: t('biomes.columns.name'), cell: (i) => i.getValue() }),
      h.accessor('slug', { header: t('biomes.columns.slug'), cell: (i) => i.getValue() }),
      h.accessor('climate', { header: t('biomes.columns.climate'), cell: (i) => i.getValue() ?? '' }),
      h.accessor('description', { header: t('biomes.columns.description'), cell: (i) => i.getValue() ?? '' }),
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
    <ListPage<Biome>
      title={t('biomes.title')}
      columns={columns}
      fetcher={listBiomes}
      queryKeyBase={['biomes']}
      initialQuery={initialQuery}
      initialPage={initialPage}
      initialPageSize={initialPageSize}
      autoloadOnMount
      onStateChange={handleStateChange}
    />
  );
}

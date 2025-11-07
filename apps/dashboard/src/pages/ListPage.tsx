import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { Alert, Paper, Stack, TextField, Typography } from '@mui/material';
import { ColumnDef, type PaginationState } from '@tanstack/react-table';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import DataTable from '../components/data-table/DataTable';
import { useSearch } from '../providers/SearchProvider';

type Fetcher<T> = (q: string, page?: number, pageSize?: number) => Promise<{ items: T[]; page: number; pageSize: number; total: number }>;

type CriteriaState = { query: string; page: number; pageSize: number };

type ListPageProps<T> = {
  title: string;
  columns: ColumnDef<T, any>[];
  fetcher: Fetcher<T>;
  queryKeyBase?: readonly unknown[];
  initialQuery?: string;
  initialPage?: number;
  initialPageSize?: number;
  autoloadOnMount?: boolean;
  onStateChange?: (state: CriteriaState) => void;
};

export default function ListPage<T extends { id?: string }>({
  title,
  columns,
  fetcher,
  queryKeyBase,
  initialQuery = '',
  initialPage = 0,
  initialPageSize = 25,
  autoloadOnMount = false,
  onStateChange,
}: ListPageProps<T>) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [criteria, setCriteria] = useState<CriteriaState>({ query: initialQuery, page: initialPage, pageSize: initialPageSize });
  const { query: searchValue, debouncedQuery, setQuery, commitQuery } = useSearch();
  const shouldFetchRef = useRef<boolean>(autoloadOnMount);
  const [hasSearched, setHasSearched] = useState<boolean>(autoloadOnMount);

  const baseKey = useMemo(() => queryKeyBase ?? ['list', title.toLowerCase()], [queryKeyBase, title]);
  const queryKey = useMemo(
    () => [...baseKey, { q: criteria.query, page: criteria.page, pageSize: criteria.pageSize }],
    [baseKey, criteria.page, criteria.pageSize, criteria.query],
  );

  const { data, isFetching, isError, error, refetch } = useQuery({
    queryKey,
    queryFn: () => fetcher(criteria.query, criteria.page, criteria.pageSize),
    enabled: false,
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    const next = { query: initialQuery, page: initialPage, pageSize: initialPageSize };
    commitQuery(next.query);
    setCriteria((prev) => {
      if (prev.query === next.query && prev.page === next.page && prev.pageSize === next.pageSize) {
        return prev;
      }
      shouldFetchRef.current = true;
      return next;
    });
  }, [initialQuery, initialPage, initialPageSize, commitQuery]);

  useEffect(() => {
    onStateChange?.(criteria);
  }, [criteria, onStateChange]);

  useEffect(() => {
    if (!shouldFetchRef.current) return;
    shouldFetchRef.current = false;
    setHasSearched(true);
    if (!criteria.query && autoloadOnMount) {
      queryClient.prefetchQuery({ queryKey, queryFn: () => fetcher(criteria.query, criteria.page, criteria.pageSize) });
    }
    refetch();
  }, [autoloadOnMount, criteria, fetcher, queryClient, queryKey, refetch]);

  const triggerFetch = useCallback(
    (updater: CriteriaState | ((prev: CriteriaState) => CriteriaState), options?: { force?: boolean }) => {
      const force = options?.force ?? false;
      setCriteria((prev) => {
        const next = typeof updater === 'function' ? (updater as (prev: CriteriaState) => CriteriaState)(prev) : updater;
        const unchanged = next.query === prev.query && next.page === prev.page && next.pageSize === prev.pageSize;
        if (unchanged && !force) {
          return prev;
        }
        shouldFetchRef.current = true;
        return unchanged ? { ...prev } : next;
      });
    },
    [],
  );

  useEffect(() => {
    if (!autoloadOnMount) return;
    if (debouncedQuery === criteria.query) return;
    triggerFetch((prev) => ({ ...prev, query: debouncedQuery, page: 0 }));
  }, [autoloadOnMount, criteria.query, debouncedQuery, triggerFetch]);

  const handleInputChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
  }, [setQuery]);

  const handleManualSearch = useCallback(() => {
    const nextQuery = commitQuery();
    const force = nextQuery === criteria.query;
    triggerFetch(
      (prev) => ({ ...prev, query: nextQuery, page: force ? prev.page : 0 }),
      { force },
    );
  }, [commitQuery, criteria.query, triggerFetch]);

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    handleManualSearch();
  }, [handleManualSearch]);

  const handlePaginationChange = useCallback(
    (updater: PaginationState | ((prev: PaginationState) => PaginationState)) => {
      const current = { pageIndex: criteria.page, pageSize: criteria.pageSize };
      const next = typeof updater === 'function' ? (updater as (prev: PaginationState) => PaginationState)(current) : updater;
      triggerFetch((prev) => {
        const nextSize = next.pageSize;
        const nextPage = next.pageIndex;
        if (nextSize !== prev.pageSize) {
          return { ...prev, page: 0, pageSize: nextSize };
        }
        return { ...prev, page: nextPage };
      });
    },
    [criteria.page, criteria.pageSize, triggerFetch],
  );

  const paginationState = useMemo<PaginationState>(() => ({ pageIndex: criteria.page, pageSize: criteria.pageSize }), [criteria.page, criteria.pageSize]);

  const pagedData = data ?? { items: [] as T[], total: 0, page: criteria.page, pageSize: criteria.pageSize };
  const items = pagedData.items ?? [];
  const showSkeleton = isFetching && !data;

  return (
    <Paper className="p-4">
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }} className="mb-4">
        <Typography variant="h6">{title}</Typography>
        <div className="flex-1" />
        <TextField
          size="small"
          placeholder={t('common:search.placeholder')}
          value={searchValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
        />
      </Stack>
      {isError && !isFetching && (
        <Alert severity="error" className="mb-3">
          {error instanceof Error ? error.message : t('common:feedback.loadError')}
        </Alert>
      )}
      <DataTable<T>
        data={items}
        columns={columns}
        selectable={false}
        loading={showSkeleton}
        pagination={paginationState}
        onPaginationChange={handlePaginationChange}
      />
      {!autoloadOnMount && !hasSearched && !isFetching && (
        <div className="text-sm text-gray-500 mt-2">{t('common:search.pressEnter')}</div>
      )}
    </Paper>
  );
}

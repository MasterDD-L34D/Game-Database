
import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { Paper, Typography, Box, Stack, TextField, Button } from '@mui/material';
import ExportMenu from '../components/ExportMenu';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { Stile, Pattern, Peso, Curvatura } from '../types/record';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { listRecords } from '../lib/records';
import FilterChips from '../components/FilterChips';
import FilterSidebar from '../components/FilterSidebar';
import RecordTable from '../features/records/components/RecordTable';
import { useSearch } from '../providers/SearchProvider';

const FILTERS_KEY = 'records-filters-v1';

export default function Records() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [openFilters, setOpenFilters] = useState(false);
  const { query, setQuery, commitQuery, debouncedQuery } = useSearch();
  const [filters, setFilters] = useState<{ stile?: Stile; pattern?: Pattern; peso?: Peso; curvatura?: Curvatura }>({});
  const [page] = useState(0);
  const [pageSize] = useState(25);
  const [sort] = useState<string | undefined>(undefined);
  const { t } = useTranslation(['records', 'common']);

  useEffect(() => {
    const fromUrl: any = {
      q: searchParams.get('q') || undefined,
      stile: (searchParams.get('stile') as Stile) || undefined,
      pattern: (searchParams.get('pattern') as Pattern) || undefined,
      peso: (searchParams.get('peso') as Peso) || undefined,
      curvatura: (searchParams.get('curvatura') as Curvatura) || undefined,
    };
    const savedFilters = localStorage.getItem(FILTERS_KEY);
    const fStore = savedFilters ? JSON.parse(savedFilters) : {};
    commitQuery(fromUrl.q ?? fStore.q ?? '');
    setFilters({ stile: fromUrl.stile ?? fStore.stile, pattern: fromUrl.pattern ?? fStore.pattern, peso: fromUrl.peso ?? fStore.peso, curvatura: fromUrl.curvatura ?? fStore.curvatura });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commitQuery]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (debouncedQuery) params.set('q', debouncedQuery); else params.delete('q');
    (['stile','pattern','peso','curvatura'] as const).forEach((k) => {
      const v = (filters as any)[k];
      if (v) params.set(k, v); else params.delete(k);
    });
    setSearchParams(params, { replace: true });
    localStorage.setItem(FILTERS_KEY, JSON.stringify({ q: debouncedQuery, ...filters }));
  }, [debouncedQuery, filters, setSearchParams]);

  const { data, isLoading } = useQuery({
    queryKey: ['records', debouncedQuery, filters, page, pageSize, sort],
    queryFn: () => listRecords({ q: debouncedQuery, page, pageSize, sort, ...filters }),
  });
  const items = data?.items ?? [];
  const total = data?.total ?? items.length;

  const chips = useMemo(() => {
    const map: { label: string; value: string }[] = [];
    if (filters.stile) map.push({ label: t('records:list.chips.stile', { value: filters.stile }), value: 'stile' });
    if (filters.pattern) map.push({ label: t('records:list.chips.pattern', { value: filters.pattern }), value: 'pattern' });
    if (filters.peso) map.push({ label: t('records:list.chips.peso', { value: filters.peso }), value: 'peso' });
    if (filters.curvatura) map.push({ label: t('records:list.chips.curvatura', { value: filters.curvatura }), value: 'curvatura' });
    return map;
  }, [filters, t]);

  function buildServerQuery() {
    const usp = new URLSearchParams();
    if (debouncedQuery) usp.set('q', debouncedQuery);
    (['stile','pattern','peso','curvatura'] as const).forEach((k) => { const v = (filters as any)[k]; if (v) usp.set(k, v); });
    return usp.toString();
  }

  const handleInputChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
  }, [setQuery]);

  const handleInputKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    commitQuery();
  }, [commitQuery]);

  const handleInputBlur = useCallback(() => {
    commitQuery();
  }, [commitQuery]);

  return (
    <Paper
      sx={(theme) => ({
        padding: theme.layout.cardPadding,
        boxShadow: theme.customShadows.card,
        backgroundColor: theme.palette.background.paper,
      })}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        sx={(theme) => ({ mb: theme.spacing(2) })}
      >
        <Typography variant="h6">{t('records:list.title')}</Typography>
        <Box sx={{ flexGrow: 1 }} />
        <TextField
          size="small"
          placeholder={t('common:search.placeholder')}
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleInputKeyDown}
          onBlur={handleInputBlur}
        />
        <Button variant="outlined" onClick={()=>setOpenFilters(true)}>{t('records:list.filtersButton')}</Button>
        <ExportMenu
          filename={t('records:list.exportFilename')}
          rows={items}
          serverQuery={buildServerQuery()}
          fields={[
            { key: 'id', label: t('records:common.fields.id') },
            { key: 'nome', label: t('records:common.fields.name') },
            { key: 'stile', label: t('records:common.fields.style') },
            { key: 'pattern', label: t('records:common.fields.pattern') },
            { key: 'peso', label: t('records:common.fields.weight') },
            { key: 'curvatura', label: t('records:common.fields.curvature') },
            { key: 'stato', label: t('records:common.fields.status') },
            { key: 'createdBy', label: t('records:common.fields.createdBy') },
            { key: 'updatedAt', label: t('records:common.fields.updatedAt') },
          ]}
        />
        <Button variant="contained" onClick={()=>navigate('/records/new')}>{t('common:actions.add')}</Button>
      </Stack>
      <FilterChips filters={chips} onRemove={(key)=>setFilters((f)=>({ ...f, [key]: undefined }))} />
      <FilterSidebar open={openFilters} value={filters} onChange={setFilters} onClear={()=>setFilters({})} onClose={()=>setOpenFilters(false)} />
      <Box sx={(theme) => ({ mt: theme.spacing(4) })}>
        <RecordTable data={items} total={total} loading={isLoading} />
      </Box>
    </Paper>
  );
}

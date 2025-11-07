
import { useEffect, useMemo, useState } from 'react';
import { Paper, Typography, Box, Stack, TextField, Button } from '@mui/material';
import ExportMenu from '../components/ExportMenu';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { Stile, Pattern, Peso, Curvatura } from '../types/record';
import { useQuery } from '@tanstack/react-query';
import { listRecords } from '../lib/records';
import FilterChips from '../components/FilterChips';
import FilterSidebar from '../components/FilterSidebar';
import RecordTable from '../features/records/components/RecordTable';

const FILTERS_KEY = 'records-filters-v1';

export default function Records() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [openFilters, setOpenFilters] = useState(false);

  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<{ stile?: Stile; pattern?: Pattern; peso?: Peso; curvatura?: Curvatura }>({});

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
    setQuery(fromUrl.q ?? fStore.q ?? '');
    setFilters({ stile: fromUrl.stile ?? fStore.stile, pattern: fromUrl.pattern ?? fStore.pattern, peso: fromUrl.peso ?? fStore.peso, curvatura: fromUrl.curvatura ?? fStore.curvatura });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (query) params.set('q', query); else params.delete('q');
    (['stile','pattern','peso','curvatura'] as const).forEach((k) => {
      const v = (filters as any)[k];
      if (v) params.set(k, v); else params.delete(k);
    });
    setSearchParams(params, { replace: true });
    localStorage.setItem(FILTERS_KEY, JSON.stringify({ q: query, ...filters }));
  }, [query, filters, setSearchParams]);

  const { data, isLoading } = useQuery({ queryKey: ['records', query, filters], queryFn: () => listRecords({ q: query, page: 0, pageSize: 25, ...filters }) });
  const items = data?.items ?? [];
  const total = data?.total ?? items.length;

  const chips = useMemo(() => {
    const map: { label: string; value: string }[] = [];
    if (filters.stile) map.push({ label: `Stile: ${filters.stile}`, value: 'stile' });
    if (filters.pattern) map.push({ label: `Pattern: ${filters.pattern}`, value: 'pattern' });
    if (filters.peso) map.push({ label: `Peso: ${filters.peso}`, value: 'peso' });
    if (filters.curvatura) map.push({ label: `Curvatura: ${filters.curvatura}`, value: 'curvatura' });
    return map;
  }, [filters]);

  function buildServerQuery() {
    const usp = new URLSearchParams();
    if (query) usp.set('q', query);
    (['stile','pattern','peso','curvatura'] as const).forEach((k) => { const v = (filters as any)[k]; if (v) usp.set(k, v); });
    return usp.toString();
  }

  return (
    <Paper className="p-4">
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }} className="mb-2">
        <Typography variant="h6">Record</Typography>
        <Box flex={1} />
        <TextField size="small" placeholder="Cerca" value={query} onChange={(e)=>setQuery(e.target.value)} />
        <Button variant="outlined" onClick={()=>setOpenFilters(true)}>Filtri</Button>
        <ExportMenu filename="record" rows={items} serverQuery={buildServerQuery()} fields={[{ key: 'id', label: 'ID' }, { key: 'nome', label: 'Nome' }, { key: 'stile', label: 'Stile' }, { key: 'pattern', label: 'Pattern' }, { key: 'peso', label: 'Peso' }, { key: 'curvatura', label: 'Curvatura' }, { key: 'stato', label: 'Stato' }, { key: 'createdBy', label: 'Creato da' }, { key: 'updatedAt', label: 'Aggiornato il' }]} />
        <Button variant="contained" onClick={()=>navigate('/records/new')}>Aggiungi</Button>
      </Stack>
      <FilterChips filters={chips} onRemove={(key)=>setFilters((f)=>({ ...f, [key]: undefined }))} />
      <FilterSidebar open={openFilters} value={filters} onChange={setFilters} onClear={()=>setFilters({})} onClose={()=>setOpenFilters(false)} />
      <Box className="mt-4">
        <RecordTable data={items} total={total} loading={isLoading} />
      </Box>
    </Paper>
  );
}

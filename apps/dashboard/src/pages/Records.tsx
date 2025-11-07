
import { useEffect, useMemo, useState } from 'react';
import { Paper, Typography, Box, Stack, TextField, Button } from '@mui/material';
import { ColumnDef, createColumnHelper, RowSelectionState, VisibilityState, ColumnPinningState, ColumnSizingState } from '@tanstack/react-table';
import DataTable from '../components/data-table/DataTable';
import RowActionsMenu from '../components/data-table/RowActionsMenu';
import ExportMenu from '../components/ExportMenu';
import LoadingTableSkeleton from '../components/LoadingTableSkeleton';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { RecordRow, Stile, Pattern, Peso, Curvatura } from '../types/record';
import { useQuery } from '@tanstack/react-query';
import { listRecords, updateRecord, deleteRecord } from '../lib/records';
import FilterChips from '../components/FilterChips';
import FilterSidebar from '../components/FilterSidebar';
import RecordToolbar from '../components/RecordToolbar';
import { df } from '../lib/formatters';

const columnHelper = createColumnHelper<RecordRow>();

const columns: ColumnDef<RecordRow, any>[] = [
  columnHelper.accessor('nome', { header: 'Nome', cell: i => i.getValue(), enableSorting: true }),
  columnHelper.accessor('stile', { header: 'Stile', cell: i => i.getValue() ?? '', enableSorting: true }),
  columnHelper.accessor('pattern', { header: 'Pattern', cell: i => i.getValue() ?? '', enableSorting: true }),
  columnHelper.accessor('peso', { header: 'Peso', cell: i => i.getValue() ?? '', enableSorting: true }),
  columnHelper.accessor('curvatura', { header: 'Curvatura', cell: i => i.getValue() ?? '', enableSorting: true }),
  columnHelper.accessor('stato', { header: 'Stato', cell: i => i.getValue(), enableSorting: true }),
  columnHelper.accessor('createdBy', { header: 'Creato da', cell: i => i.getValue() ?? '', enableSorting: true }),
  columnHelper.accessor('updatedAt', { header: 'Aggiornato il', cell: i => (i.getValue() ? df.format(new Date(i.getValue() as string)) : ''), enableSorting: true }),
  columnHelper.display({
    id: 'actions',
    header: () => <Box textAlign="right">Azioni</Box>,
    cell: ({ row }) => (
      <Box textAlign="right">
        <RowActionsMenu onView={() => alert(`Dettagli ${row.original.nome}`)} onEdit={() => alert(`Modifica ${row.original.nome}`)} onDelete={() => alert(`Elimina ${row.original.nome}`)} />
      </Box>
    ),
    enableSorting: false,
  }),
];

const FILTERS_KEY = 'records-filters-v1';
const TABLE_KEY = 'records-table-v1';

export default function Records() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [openFilters, setOpenFilters] = useState(false);

  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<{ stile?: Stile; pattern?: Pattern; peso?: Peso; curvatura?: Curvatura }>({});

  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnPinning, setColumnPinning] = useState<ColumnPinningState>({ left: [], right: [] });
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const [density, setDensity] = useState<'compact' | 'normal'>('compact');

  useEffect(() => {
    const fromUrl: any = {
      q: searchParams.get('q') || undefined,
      stile: (searchParams.get('stile') as Stile) || undefined,
      pattern: (searchParams.get('pattern') as Pattern) || undefined,
      peso: (searchParams.get('peso') as Peso) || undefined,
      curvatura: (searchParams.get('curvatura') as Curvatura) || undefined,
    };
    const savedFilters = localStorage.getItem(FILTERS_KEY);
    const savedTable = localStorage.getItem(TABLE_KEY);
    const fStore = savedFilters ? JSON.parse(savedFilters) : {};
    const tStore = savedTable ? JSON.parse(savedTable) : {};
    setQuery(fromUrl.q ?? fStore.q ?? '');
    setFilters({ stile: fromUrl.stile ?? fStore.stile, pattern: fromUrl.pattern ?? fStore.pattern, peso: fromUrl.peso ?? fStore.peso, curvatura: fromUrl.curvatura ?? fStore.curvatura });
    if (tStore.columnVisibility) setColumnVisibility(tStore.columnVisibility);
    if (tStore.columnPinning) setColumnPinning(tStore.columnPinning);
    if (tStore.columnSizing) setColumnSizing(tStore.columnSizing);
    if (tStore.density) setDensity(tStore.density);
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

  useEffect(() => {
    localStorage.setItem(TABLE_KEY, JSON.stringify({ columnVisibility, columnPinning, columnSizing, density }));
  }, [columnVisibility, columnPinning, columnSizing, density]);

  const { data, isLoading, refetch } = useQuery({ queryKey: ['records', query, filters], queryFn: () => listRecords({ q: query, page: 0, pageSize: 25, ...filters }) });
  const items = data?.items ?? []; const total = data?.total ?? items.length;
  const selectedRows = useMemo(() => items.filter(r => r.id && (rowSelection as any)[r.id]), [items, rowSelection]);

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

  async function bulkStatusChange(next: 'Attivo'|'Bozza'|'Archiviato') {
    await Promise.all(selectedRows.map(r => updateRecord(r.id!, { stato: next })));
    setRowSelection({}); refetch();
  }
  async function bulkDelete() {
    if (!selectedRows.length) return;
    if (!confirm(`Eliminare ${selectedRows.length} record?`)) return;
    await Promise.all(selectedRows.map(r => deleteRecord(r.id!)));
    setRowSelection({}); refetch();
  }

  const pinnedLeft = columnPinning.left ?? []; const pinnedRight = columnPinning.right ?? [];
  const columnsMeta = [
    { id: 'nome', label: 'Nome' },
    { id: 'stile', label: 'Stile' },
    { id: 'pattern', label: 'Pattern' },
    { id: 'peso', label: 'Peso' },
    { id: 'curvatura', label: 'Curvatura' },
    { id: 'stato', label: 'Stato' },
    { id: 'createdBy', label: 'Creato da' },
    { id: 'updatedAt', label: 'Aggiornato il' },
    { id: 'actions', label: 'Azioni' },
  ].map(c => ({ ...c, visible: (columnVisibility as any)[c.id] !== false, pinned: pinnedLeft.includes(c.id) ? 'left' : pinnedRight.includes(c.id) ? 'right' : false }));

  function pinColumn(id: string, side: 'left'|'right'|false){
    setColumnPinning(prev => {
      const left = new Set(prev.left ?? []); const right = new Set(prev.right ?? []);
      left.delete(id); right.delete(id); if (side==='left') left.add(id); if (side==='right') right.add(id);
      return { left: Array.from(left), right: Array.from(right) };
    });
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
      <RecordToolbar total={total} selectedCount={selectedRows.length} density={density} onDensityChange={setDensity} columns={columnsMeta} onToggleColumn={(id, visible)=>setColumnVisibility((p)=>({ ...p, [id]: visible }))} onPinColumn={pinColumn} onBulkDelete={bulkDelete} onBulkStatusChange={bulkStatusChange} onClearSelection={()=>setRowSelection({})} selectedRows={selectedRows} />
      <FilterSidebar open={openFilters} value={filters} onChange={setFilters} onClear={()=>setFilters({})} onClose={()=>setOpenFilters(false)} />
      <Box className="mt-4">{isLoading ? (<LoadingTableSkeleton />) : (<DataTable<RecordRow> data={items} columns={columns} selectable density={density} rowSelection={rowSelection} onRowSelectionChange={setRowSelection} columnVisibility={columnVisibility} onColumnVisibilityChange={setColumnVisibility} columnSizing={columnSizing} onColumnSizingChange={setColumnSizing} columnPinning={columnPinning} onColumnPinningChange={setColumnPinning} getRowId={(r)=>r.id!} />)}</Box>
    </Paper>
  );
}

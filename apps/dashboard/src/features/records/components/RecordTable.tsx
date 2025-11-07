import { useCallback, useEffect, useMemo, useState } from 'react';
import { Box } from '@mui/material';
import { ColumnDef, ColumnPinningState, ColumnSizingState, RowSelectionState, VisibilityState, createColumnHelper } from '@tanstack/react-table';
import { useQueryClient } from '@tanstack/react-query';
import DataTable from '../../../components/data-table/DataTable';
import RecordToolbar from '../../../components/RecordToolbar';
import type { RecordRow } from '../../../types/record';
import { df } from '../../../lib/formatters';
import { updateRecord } from '../../../lib/records';
import RecordRowActions from './RecordRowActions';
import RecordDeleteDialog from './RecordDeleteDialog';
import { useDeleteRecordsMutation } from '../api/useDeleteRecordsMutation';

type Props = {
  data: RecordRow[];
  total: number;
  loading?: boolean;
};

const TABLE_KEY = 'records-table-v1';
const columnHelper = createColumnHelper<RecordRow>();

export default function RecordTable({ data, total, loading }: Props) {
  const queryClient = useQueryClient();
  const deleteMutation = useDeleteRecordsMutation();

  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnPinning, setColumnPinning] = useState<ColumnPinningState>({ left: [], right: [] });
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const [density, setDensity] = useState<'compact' | 'normal'>('compact');
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; records: RecordRow[] }>({ open: false, records: [] });

  useEffect(() => {
    const savedTable = localStorage.getItem(TABLE_KEY);
    if (!savedTable) return;
    try {
      const parsed = JSON.parse(savedTable);
      if (parsed.columnVisibility) setColumnVisibility(parsed.columnVisibility);
      if (parsed.columnPinning) setColumnPinning(parsed.columnPinning);
      if (parsed.columnSizing) setColumnSizing(parsed.columnSizing);
      if (parsed.density) setDensity(parsed.density);
    } catch (error) {
      console.warn('Impossibile ripristinare le preferenze della tabella dei record:', error);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(TABLE_KEY, JSON.stringify({ columnVisibility, columnPinning, columnSizing, density }));
  }, [columnVisibility, columnPinning, columnSizing, density]);

  const selectedRows = useMemo(() => data.filter((record) => record.id && rowSelection[record.id]), [data, rowSelection]);

  const handleDeleteRecord = useCallback((record: RecordRow) => {
    if (!record.id) return;
    setDeleteDialog({ open: true, records: [record] });
  }, []);

  const handleBulkDelete = useCallback(() => {
    const deletable = selectedRows.filter((record): record is RecordRow & { id: string } => Boolean(record.id));
    if (!deletable.length) return;
    setDeleteDialog({ open: true, records: deletable });
  }, [selectedRows]);

  const columns = useMemo<ColumnDef<RecordRow, any>[]>(() => [
    columnHelper.accessor('nome', { header: 'Nome', cell: (info) => info.getValue(), enableSorting: true }),
    columnHelper.accessor('stile', { header: 'Stile', cell: (info) => info.getValue() ?? '', enableSorting: true }),
    columnHelper.accessor('pattern', { header: 'Pattern', cell: (info) => info.getValue() ?? '', enableSorting: true }),
    columnHelper.accessor('peso', { header: 'Peso', cell: (info) => info.getValue() ?? '', enableSorting: true }),
    columnHelper.accessor('curvatura', { header: 'Curvatura', cell: (info) => info.getValue() ?? '', enableSorting: true }),
    columnHelper.accessor('stato', { header: 'Stato', cell: (info) => info.getValue(), enableSorting: true }),
    columnHelper.accessor('createdBy', { header: 'Creato da', cell: (info) => info.getValue() ?? '', enableSorting: true }),
    columnHelper.accessor('updatedAt', {
      header: 'Aggiornato il',
      cell: (info) => (info.getValue() ? df.format(new Date(info.getValue() as string)) : ''),
      enableSorting: true,
    }),
    columnHelper.display({
      id: 'actions',
      header: () => <Box textAlign="right">Azioni</Box>,
      cell: ({ row }) => (
        <Box textAlign="right">
          <RecordRowActions record={row.original} onDelete={handleDeleteRecord} />
        </Box>
      ),
      enableSorting: false,
    }),
  ], [handleDeleteRecord]);

  const pinnedLeft = columnPinning.left ?? [];
  const pinnedRight = columnPinning.right ?? [];
  const columnsMeta = useMemo(() => [
    { id: 'nome', label: 'Nome' },
    { id: 'stile', label: 'Stile' },
    { id: 'pattern', label: 'Pattern' },
    { id: 'peso', label: 'Peso' },
    { id: 'curvatura', label: 'Curvatura' },
    { id: 'stato', label: 'Stato' },
    { id: 'createdBy', label: 'Creato da' },
    { id: 'updatedAt', label: 'Aggiornato il' },
    { id: 'actions', label: 'Azioni' },
  ].map((column) => ({
    ...column,
    visible: columnVisibility[column.id] !== false,
    pinned: pinnedLeft.includes(column.id) ? 'left' : pinnedRight.includes(column.id) ? 'right' : false,
  })), [columnVisibility, pinnedLeft, pinnedRight]);

  const handleBulkStatusChange = useCallback(async (next: 'Attivo' | 'Bozza' | 'Archiviato') => {
    if (!selectedRows.length) return;
    await Promise.all(selectedRows.map((record) => record.id ? updateRecord(record.id, { stato: next }) : null));
    setRowSelection({});
    queryClient.invalidateQueries({ queryKey: ['records'] });
  }, [queryClient, selectedRows]);

  const handleCloseDialog = useCallback(() => {
    if (deleteMutation.isPending) return;
    setDeleteDialog({ open: false, records: [] });
  }, [deleteMutation.isPending]);

  const handleDeleted = useCallback(async () => {
    setRowSelection({});
    await queryClient.invalidateQueries({ queryKey: ['records'] });
  }, [queryClient]);

  const pinColumn = useCallback((id: string, side: 'left' | 'right' | false) => {
    setColumnPinning((prev) => {
      const left = new Set(prev.left ?? []);
      const right = new Set(prev.right ?? []);
      left.delete(id);
      right.delete(id);
      if (side === 'left') left.add(id);
      if (side === 'right') right.add(id);
      return { left: Array.from(left), right: Array.from(right) };
    });
  }, []);

  return (
    <>
      <RecordToolbar
        total={total}
        selectedCount={selectedRows.length}
        density={density}
        onDensityChange={setDensity}
        columns={columnsMeta}
        onToggleColumn={(id, visible) => setColumnVisibility((prev) => ({ ...prev, [id]: visible }))}
        onPinColumn={pinColumn}
        onBulkDelete={handleBulkDelete}
        onBulkStatusChange={handleBulkStatusChange}
        onClearSelection={() => setRowSelection({})}
        selectedRows={selectedRows}
      />
      <Box className="mt-4">
        <DataTable<RecordRow>
          data={data}
          columns={columns}
          loading={loading}
          density={density}
          rowSelection={rowSelection}
          onRowSelectionChange={setRowSelection}
          columnVisibility={columnVisibility}
          onColumnVisibilityChange={setColumnVisibility}
          columnSizing={columnSizing}
          onColumnSizingChange={setColumnSizing}
          columnPinning={columnPinning}
          onColumnPinningChange={setColumnPinning}
          getRowId={(record) => record.id ?? ''}
        />
      </Box>
      <RecordDeleteDialog
        open={deleteDialog.open}
        records={deleteDialog.records}
        onClose={handleCloseDialog}
        onDeleted={handleDeleted}
        mutation={deleteMutation}
      />
    </>
  );
}

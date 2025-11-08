
import { useState } from 'react';
import { ColumnDef, flexRender, getCoreRowModel, getSortedRowModel, getPaginationRowModel, SortingState, PaginationState, RowSelectionState, VisibilityState, ColumnSizingState, ColumnPinningState, useReactTable } from '@tanstack/react-table';
import { Table, TableHead, TableRow, TableCell, TableBody, Box, Checkbox } from '@mui/material';
import PaginationBar from '../PaginationBar';
import LoadingTableSkeleton from '../LoadingTableSkeleton';
import { ArrowUpIcon, ArrowDownIcon, ChevronUpDownIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';

type Density = 'compact' | 'normal';
type Props<TData extends { id?: string }> = {
  data: TData[]; columns: ColumnDef<TData, any>[]; loading?: boolean; pageSizeOptions?: number[]; density?: Density; selectable?: boolean;
  rowSelection?: RowSelectionState; onRowSelectionChange?: any;
  columnVisibility?: VisibilityState; onColumnVisibilityChange?: any;
  columnSizing?: ColumnSizingState; onColumnSizingChange?: any;
  columnPinning?: ColumnPinningState; onColumnPinningChange?: any;
  getRowId?: (originalRow: TData, index: number) => string;
  pagination?: PaginationState; onPaginationChange?: (updater: PaginationState | ((prev: PaginationState) => PaginationState)) => void;
};

export default function DataTable<TData extends { id?: string }>({
  data, columns, loading, pageSizeOptions = [10,25,50], density = 'compact', selectable = true,
  rowSelection: extRowSel, onRowSelectionChange: setExtRowSel,
  columnVisibility: extColVis, onColumnVisibilityChange: setExtColVis,
  columnSizing: extColSize, onColumnSizingChange: setExtColSize,
  columnPinning: extColPin, onColumnPinningChange: setExtColPin,
  pagination: extPagination, onPaginationChange: setExtPagination,
  getRowId,
}: Props<TData>) {
  const { t } = useTranslation('table');
  const [sorting, setSorting] = useState<SortingState>([]);
  const [intPagination, setIntPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: pageSizeOptions[0] });
  const pagination = extPagination ?? intPagination; const setPagination = setExtPagination ?? setIntPagination;
  const [intRowSel, setIntRowSel] = useState<RowSelectionState>({}); const rowSelection = extRowSel ?? intRowSel; const setRowSelection = setExtRowSel ?? setIntRowSel;
  const [intColVis, setIntColVis] = useState<VisibilityState>({}); const columnVisibility = extColVis ?? intColVis; const setColumnVisibility = setExtColVis ?? setIntColVis;
  const [intColSize, setIntColSize] = useState<ColumnSizingState>({}); const columnSizing = extColSize ?? intColSize; const setColumnSizing = setExtColSize ?? setIntColSize;
  const [intColPin, setIntColPin] = useState<ColumnPinningState>({ left: [], right: [] }); const columnPinning = extColPin ?? intColPin; const setColumnPinning = setExtColPin ?? setIntColPin;

  const table = useReactTable({
    data, columns, state: { sorting, pagination, rowSelection, columnVisibility, columnSizing, columnPinning },
    onSortingChange: setSorting, onPaginationChange: setPagination, onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility, onColumnSizingChange: setColumnSizing, onColumnPinningChange: setColumnPinning,
    getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(), getPaginationRowModel: getPaginationRowModel(),
    enableRowSelection: selectable, getRowId: getRowId ?? ((row: any, i) => row.id ?? String(i)), columnResizeMode: 'onChange',
  });

  const rows = table.getRowModel().rows; const count = data.length; const tableSize = density === 'compact' ? 'small' : 'medium';
  const baseLeftOffset = selectable ? 48 : 0;
  function leftOffsetFor(id: string){ const left = table.getState().columnPinning.left ?? []; let offset = baseLeftOffset; for (const colId of left){ if (colId===id) break; const col = table.getColumn(colId); offset += col.getSize(); } return offset; }
  function rightOffsetFor(id: string){ const right = table.getState().columnPinning.right ?? []; let offset = 0; for (const colId of right){ if (colId===id) break; const col = table.getColumn(colId); offset += col.getSize(); } return offset; }

  return (
    <Box>
      <Box className="overflow-x-auto">
        {loading ? (<LoadingTableSkeleton />) : (
          <Table size={tableSize} aria-label={t('aria.table')}>
            <TableHead>
              {table.getHeaderGroups().map(hg => (
                <TableRow key={hg.id}>
                  {selectable && (
                    <TableCell padding="checkbox" sx={{ position: 'sticky', left: 0, backgroundColor: 'background.paper', zIndex: 3 }}>
                      <Checkbox indeterminate={table.getIsSomeRowsSelected()} checked={table.getIsAllRowsSelected()} onChange={table.getToggleAllRowsSelectedHandler()} inputProps={{ 'aria-label': t('aria.selectAllRows') }} />
                    </TableCell>
                  )}
                  {hg.headers.map(header => {
                    const sortable = header.column.getCanSort(); const isSorted = header.column.getIsSorted(); const pin = header.column.getIsPinned(); const width = header.column.getSize();
                    const stickyStyles = pin === 'left' ? { position: 'sticky', left: leftOffsetFor(header.column.id), zIndex: 2 }
                      : pin === 'right' ? { position: 'sticky', right: rightOffsetFor(header.column.id), zIndex: 2 } : {};
                    return (
                      <TableCell key={header.id} onClick={sortable ? header.column.getToggleSortingHandler() : undefined}
                        sx={{ top: 0, position: 'sticky', backgroundColor: 'background.paper', cursor: sortable ? 'pointer' : 'default', ...stickyStyles, width, minWidth: width }}
                        aria-sort={isSorted === 'asc' ? 'ascending' : isSorted === 'desc' ? 'descending' : 'none'}>
                        <div className={clsx('flex items-center gap-1 select-none relative')}>
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sortable && (isSorted === 'asc' ? <ArrowUpIcon className="h-4 w-4" /> : isSorted === 'desc' ? <ArrowDownIcon className="h-4 w-4" /> : <ChevronUpDownIcon className="h-4 w-4 text-gray-400" />)}
                          <Box component="span" onMouseDown={header.getResizeHandler()} onTouchStart={header.getResizeHandler()} sx={{ position: 'absolute', right: -3, top: 0, height: '100%', width: 6, cursor: 'col-resize', userSelect: 'none' }} />
                        </div>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableHead>
            <TableBody>
              {rows.map(r => (
                <TableRow key={r.id} hover className="even:bg-gray-50">
                  {selectable && (
                    <TableCell padding="checkbox" sx={{ position: 'sticky', left: 0, backgroundColor: 'background.paper', zIndex: 1 }}>
                      <Checkbox checked={r.getIsSelected()} indeterminate={r.getIsSomeSelected?.()} onChange={r.getToggleSelectedHandler()} inputProps={{ 'aria-label': t('aria.selectRow') }} />
                    </TableCell>
                  )}
                  {r.getVisibleCells().map(cell => {
                    const pin = cell.column.getIsPinned(); const width = cell.column.getSize();
                    const stickyStyles = pin === 'left' ? { position: 'sticky', left: leftOffsetFor(cell.column.id), zIndex: 1, backgroundColor: 'background.paper' }
                      : pin === 'right' ? { position: 'sticky', right: rightOffsetFor(cell.column.id), zIndex: 1, backgroundColor: 'background.paper' } : {};
                    return (<TableCell key={cell.id} sx={{ width, minWidth: width, ...stickyStyles }}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>);
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Box>
      <Box className="mt-2"><PaginationBar count={count} page={table.getState().pagination.pageIndex} rowsPerPage={table.getState().pagination.pageSize} onPageChange={(p)=>table.setPageIndex(p)} onRowsPerPageChange={(s)=>table.setPageSize(s)} /></Box>
    </Box>
  );
}

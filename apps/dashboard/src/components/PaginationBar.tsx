import { TablePagination } from '@mui/material';
import { useTranslation } from 'react-i18next';

type PaginationBarProps = {
  count: number;
  page: number;
  rowsPerPage: number;
  onPageChange: (page: number) => void;
  onRowsPerPageChange: (size: number) => void;
  pageSizeOptions?: number[];
};

export default function PaginationBar({ count, page, rowsPerPage, onPageChange, onRowsPerPageChange, pageSizeOptions = [10, 25, 50] }: PaginationBarProps) {
  const { t } = useTranslation('table');

  function getItemAriaLabel(type: 'first' | 'last' | 'next' | 'previous') {
    switch (type) {
      case 'first':
        return t('pagination.ariaFirst');
      case 'previous':
        return t('pagination.ariaPrevious');
      case 'next':
        return t('pagination.ariaNext');
      case 'last':
        return t('pagination.ariaLast');
      default:
        return '';
    }
  }

  function labelDisplayedRows({ from, to, count: total }: { from: number; to: number; count: number }) {
    if (total === -1) {
      return t('pagination.displayedRowsMoreThan', { from, to, count: to });
    }
    return t('pagination.displayedRows', { from, to, count: total });
  }

  return (
    <TablePagination
      component="div"
      count={count}
      page={page}
      onPageChange={(_, p) => onPageChange(p)}
      rowsPerPage={rowsPerPage}
      onRowsPerPageChange={(e) => onRowsPerPageChange(parseInt(e.target.value, 10))}
      rowsPerPageOptions={pageSizeOptions}
      labelRowsPerPage={t('pagination.rowsPerPage')}
      labelDisplayedRows={labelDisplayedRows}
      getItemAriaLabel={getItemAriaLabel}
    />
  );
}

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
  return (
    <TablePagination
      component="div"
      count={count}
      page={page}
      onPageChange={(_,p)=>onPageChange(p)}
      rowsPerPage={rowsPerPage}
      onRowsPerPageChange={(e)=>onRowsPerPageChange(parseInt(e.target.value,10))}
      rowsPerPageOptions={pageSizeOptions}
      labelRowsPerPage={t('pagination.rowsPerPage')}
    />
  );
}

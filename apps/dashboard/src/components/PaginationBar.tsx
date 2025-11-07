import { TablePagination } from '@mui/material';
import { useTranslation } from 'react-i18next';

export default function PaginationBar({ count, page, rowsPerPage, onPageChange, onRowsPerPageChange }:{ count:number; page:number; rowsPerPage:number; onPageChange:(p:number)=>void; onRowsPerPageChange:(s:number)=>void; }) {
  const { t } = useTranslation('table');
  return (
    <TablePagination
      component="div"
      count={count}
      page={page}
      onPageChange={(_,p)=>onPageChange(p)}
      rowsPerPage={rowsPerPage}
      onRowsPerPageChange={(e)=>onRowsPerPageChange(parseInt(e.target.value,10))}
      rowsPerPageOptions={[10,25,50]}
      labelRowsPerPage={t('pagination.rowsPerPage')}
    />
  );
}

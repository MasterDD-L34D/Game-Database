
import { useState } from 'react';
import { Paper, Stack, TextField, Typography } from '@mui/material';
import LoadingTableSkeleton from '../components/LoadingTableSkeleton';
import DataTable from '../components/data-table/DataTable';
import { ColumnDef } from '@tanstack/react-table';

type Fetcher<T> = (q: string, page?: number, pageSize?: number) => Promise<{ items: T[], page: number, pageSize: number, total: number }>;
export default function ListPage<T extends { id?: string }>({ title, columns, fetcher }: { title: string; columns: ColumnDef<T, any>[]; fetcher: Fetcher<T>; }) {
  const [q, setQ] = useState(''); const [data, setData] = useState<T[] | null>(null); const [loading, setLoading] = useState(false);
  async function load(){ setLoading(true); try{ const res = await fetcher(q, 0, 50); setData(res.items); } finally { setLoading(false); } }
  return (
    <Paper className="p-4">
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }} className="mb-4">
        <Typography variant="h6">{title}</Typography>
        <div className="flex-1" />
        <TextField size="small" placeholder="Cerca" value={q} onChange={(e)=>setQ(e.target.value)} onKeyDown={(e)=> e.key==='Enter' && load()} />
      </Stack>
      {loading ? <LoadingTableSkeleton /> : (<DataTable<any> data={data || []} columns={columns} selectable={false} />)}
      {!data && !loading && <div className="text-sm text-gray-500">Premi Invio per cercare.</div>}
    </Paper>
  );
}

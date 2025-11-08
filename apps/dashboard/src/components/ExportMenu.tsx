
import { useState } from 'react';
import { Button, Menu, MenuItem, ListItemText, CircularProgress } from '@mui/material';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

type Field<T> = { key: keyof T; label: string };
export default function ExportMenu<T>({ filename, rows, fields, serverQuery }: { filename: string; rows: T[]; fields: Field<T>[]; serverQuery?: string; }) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [busy, setBusy] = useState(false);
  const open = Boolean(anchorEl);
  const { t } = useTranslation(['export', 'common']);

  function downloadText(name: string, mime: string, text: string){
    const blob = new Blob([text], { type: mime }); const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
  }
  function escapeCsv(v: string){ return (v.includes(',')||v.includes('"')||v.includes('\n')) ? '"'+v.replace(/"/g,'""')+'"' : v; }
  function toCsv(): string{ const header = fields.map(f=>escapeCsv(String(f.label))).join(','); const lines = rows.map(r => fields.map(f => escapeCsv(String((r as any)[f.key] ?? ''))).join(',')); return [header, ...lines].join('\n'); }

  async function serverDownload(fmt: 'csv'|'json') {
    const base = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
    const qs = new URLSearchParams(serverQuery || ''); qs.set('format', fmt);
    const url = `${base}/records/export?${qs.toString()}`;
    setBusy(true);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const cd = res.headers.get('content-disposition'); const fallback = `${filename}.${fmt}`;
      const match = cd && /filename="([^"]+)"/i.exec(cd); const name = match?.[1] || fallback;
      const blob = await res.blob(); const link = URL.createObjectURL(blob); const a = document.createElement('a');
      a.href = link; a.download = name; a.click(); URL.revokeObjectURL(link);
    } catch (e: any) {
      const message = e?.message ?? String(e);
      alert(t('common:feedback.exportError', { message }));
    } finally { setBusy(false); }
  }

  return (<>
    <Button variant="outlined" onClick={(e)=>setAnchorEl(e.currentTarget)} startIcon={busy ? <CircularProgress size={16}/> : <ArrowDownTrayIcon className="h-5 w-5" />}>{t('export:button')}</Button>
    <Menu anchorEl={anchorEl} open={open} onClose={()=>setAnchorEl(null)}>
      {serverQuery && (<>
        <MenuItem onClick={()=>{ setAnchorEl(null); serverDownload('csv'); }}><ListItemText>{t('export:serverCsv')}</ListItemText></MenuItem>
        <MenuItem onClick={()=>{ setAnchorEl(null); serverDownload('json'); }}><ListItemText>{t('export:serverJson')}</ListItemText></MenuItem>
      </>)}
      <MenuItem onClick={()=>{ setAnchorEl(null); downloadText(`${filename}.csv`, 'text/csv;charset=utf-8', toCsv()); }}><ListItemText>{t('export:clientCsv')}</ListItemText></MenuItem>
      <MenuItem onClick={()=>{ setAnchorEl(null); downloadText(`${filename}.json`, 'application/json;charset=utf-8', JSON.stringify(rows, null, 2)); }}><ListItemText>{t('export:clientJson')}</ListItemText></MenuItem>
    </Menu>
  </>);
}


import { Paper, Stack, Typography, Button, Menu, MenuItem, ListItemIcon, ListItemText, Checkbox, Divider } from '@mui/material';
import { useState } from 'react';
import { AdjustmentsHorizontalIcon, ViewColumnsIcon } from 'lucide-react';
import ExportMenu from './ExportMenu';

export type ColumnToggle = { id: string; label: string; visible: boolean; pinned?: 'left'|'right'|false };

export default function RecordToolbar<T>({ total, selectedCount, density, onDensityChange, columns, onToggleColumn, onPinColumn, onBulkDelete, onBulkStatusChange, onClearSelection, selectedRows } : {
  total: number; selectedCount: number; density: 'compact'|'normal'; onDensityChange: (d:'compact'|'normal')=>void;
  columns: ColumnToggle[]; onToggleColumn: (id:string, visible:boolean)=>void; onPinColumn: (id:string, pin:'left'|'right'|false)=>void;
  onBulkDelete: ()=>Promise<void>|void; onBulkStatusChange: (s:'Attivo'|'Bozza'|'Archiviato')=>Promise<void>|void; onClearSelection: ()=>void; selectedRows: T[];
}) {
  const [anchorCols, setAnchorCols] = useState<null|HTMLElement>(null);
  const colsOpen = Boolean(anchorCols);
  const [anchorStatus, setAnchorStatus] = useState<null|HTMLElement>(null);
  const statusOpen = Boolean(anchorStatus);

  return (
    <Paper className="px-3 py-2" sx={{ position: 'sticky', top: 112, zIndex: 1 }}>
      {selectedCount > 0 ? (
        <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'stretch', md: 'center' }} spacing={2}>
          <Typography variant="body2"><strong>{selectedCount}</strong> selezionati</Typography>
          <div>
            <Button size="small" variant="outlined" onClick={(e)=>setAnchorStatus(e.currentTarget)}>Cambia stato</Button>
            <Menu anchorEl={anchorStatus} open={statusOpen} onClose={()=>setAnchorStatus(null)}>
              {['Attivo','Bozza','Archiviato'].map(s => (<MenuItem key={s} onClick={()=>{ setAnchorStatus(null); onBulkStatusChange(s as any); }}><ListItemText>{s}</ListItemText></MenuItem>))}
            </Menu>
          </div>
          <ExportMenu filename="record-selezionati" rows={selectedRows as any[]} fields={[{ key: 'id', label: 'ID' }, { key: 'nome', label: 'Nome' }, { key: 'stile', label: 'Stile' }, { key: 'pattern', label: 'Pattern' }, { key: 'peso', label: 'Peso' }, { key: 'curvatura', label: 'Curvatura' }, { key: 'stato', label: 'Stato' }]} />
          <Button size="small" color="error" variant="outlined" onClick={()=>onBulkDelete()}>Elimina</Button>
          <Button size="small" onClick={onClearSelection}>Deseleziona</Button>
        </Stack>
      ) : (
        <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'stretch', md: 'center' }} spacing={2}>
          <Typography variant="body2">Totale: <strong>{total}</strong></Typography>
          <div>
            <Button size="small" variant="outlined" startIcon={<ViewColumnsIcon className="h-4 w-4" />} onClick={(e)=>setAnchorCols(e.currentTarget)}>Colonne / Pin</Button>
            <Menu anchorEl={anchorCols} open={colsOpen} onClose={()=>setAnchorCols(null)}>
              {columns.map(c => (
                <MenuItem key={c.id} onClick={()=>onToggleColumn(c.id, !c.visible)}>
                  <ListItemIcon><Checkbox size="small" edge="start" tabIndex={-1} disableRipple checked={c.visible} /></ListItemIcon>
                  <ListItemText>{c.label}</ListItemText>
                </MenuItem>
              ))}
              <Divider />
              {columns.map(c => (
                <MenuItem key={c.id + '-pin'}>
                  <ListItemText>Fissa: {c.label}</ListItemText>
                  <div className="flex items-center gap-2">
                    <Button size="small" variant={c.pinned === 'left' ? 'contained' : 'outlined'} onClick={()=>onPinColumn(c.id, 'left')}>sx</Button>
                    <Button size="small" variant={!c.pinned ? 'contained' : 'outlined'} onClick={()=>onPinColumn(c.id, false)}>no</Button>
                    <Button size="small" variant={c.pinned === 'right' ? 'contained' : 'outlined'} onClick={()=>onPinColumn(c.id, 'right')}>dx</Button>
                  </div>
                </MenuItem>
              ))}
            </Menu>
          </div>
          <Button size="small" variant="outlined" startIcon={<AdjustmentsHorizontalIcon className="h-4 w-4" />} onClick={()=>onDensityChange(density === 'compact' ? 'normal' : 'compact')}>Densità: {density === 'compact' ? 'Compatta' : 'Normale'}</Button>
        </Stack>
      )}
    </Paper>
  );
}


import { Paper, Stack, Typography, Button, Menu, MenuItem, ListItemIcon, ListItemText, Checkbox, Divider } from '@mui/material';
import { useMemo, useState } from 'react';
import { Columns3Icon, SlidersHorizontalIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('records');
  const statuses = useMemo(() => [
    { value: 'Attivo' as const, label: t('records:common.statuses.attivo') },
    { value: 'Bozza' as const, label: t('records:common.statuses.bozza') },
    { value: 'Archiviato' as const, label: t('records:common.statuses.archiviato') },
  ], [t]);

  return (
    <Paper className="px-3 py-2" sx={{ position: 'sticky', top: 112, zIndex: 1 }}>
      {selectedCount > 0 ? (
        <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'stretch', md: 'center' }} spacing={2}>
          <Typography variant="body2">
            <strong>{selectedCount}</strong> {t('records:toolbar.selectedSuffix')}
          </Typography>
          <div>
            <Button size="small" variant="outlined" onClick={(e)=>setAnchorStatus(e.currentTarget)}>
              {t('records:toolbar.changeStatus')}
            </Button>
            <Menu anchorEl={anchorStatus} open={statusOpen} onClose={()=>setAnchorStatus(null)}>
              {statuses.map((status) => (
                <MenuItem key={status.value} onClick={()=>{ setAnchorStatus(null); onBulkStatusChange(status.value); }}>
                  <ListItemText>{status.label}</ListItemText>
                </MenuItem>
              ))}
            </Menu>
          </div>
          <ExportMenu
            filename={t('records:list.selectedExportFilename')}
            rows={selectedRows as any[]}
            fields={[
              { key: 'id', label: t('records:common.fields.id') },
              { key: 'nome', label: t('records:common.fields.name') },
              { key: 'stile', label: t('records:common.fields.style') },
              { key: 'pattern', label: t('records:common.fields.pattern') },
              { key: 'peso', label: t('records:common.fields.weight') },
              { key: 'curvatura', label: t('records:common.fields.curvature') },
              { key: 'stato', label: t('records:common.fields.status') },
            ]}
          />
          <Button size="small" color="error" variant="outlined" onClick={()=>onBulkDelete()}>
            {t('records:toolbar.bulkDelete')}
          </Button>
          <Button size="small" onClick={onClearSelection}>
            {t('records:toolbar.bulkDeselect')}
          </Button>
        </Stack>
      ) : (
        <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'stretch', md: 'center' }} spacing={2}>
          <Typography variant="body2">
            {t('records:toolbar.totalLabel')}: <strong>{total}</strong>
          </Typography>
          <div>
            <Button size="small" variant="outlined" startIcon={<Columns3Icon className="h-4 w-4" />} onClick={(e)=>setAnchorCols(e.currentTarget)}>
              {t('records:toolbar.columns')}
            </Button>
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
                  <ListItemText>{t('records:toolbar.pin.label', { label: c.label })}</ListItemText>
                  <div className="flex items-center gap-2">
                    <Button size="small" variant={c.pinned === 'left' ? 'contained' : 'outlined'} onClick={()=>onPinColumn(c.id, 'left')}>
                      {t('records:toolbar.pin.left')}
                    </Button>
                    <Button size="small" variant={!c.pinned ? 'contained' : 'outlined'} onClick={()=>onPinColumn(c.id, false)}>
                      {t('records:toolbar.pin.none')}
                    </Button>
                    <Button size="small" variant={c.pinned === 'right' ? 'contained' : 'outlined'} onClick={()=>onPinColumn(c.id, 'right')}>
                      {t('records:toolbar.pin.right')}
                    </Button>
                  </div>
                </MenuItem>
              ))}
            </Menu>
          </div>
          <Button size="small" variant="outlined" startIcon={<SlidersHorizontalIcon className="h-4 w-4" />} onClick={()=>onDensityChange(density === 'compact' ? 'normal' : 'compact')}>
            {t('records:toolbar.density', {
              mode: density === 'compact' ? t('records:toolbar.densityModes.compact') : t('records:toolbar.densityModes.normal'),
            })}
          </Button>
        </Stack>
      )}
    </Paper>
  );
}

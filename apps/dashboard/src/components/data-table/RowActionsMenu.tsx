
import { useState } from 'react';
import { IconButton, Menu, MenuItem, ListItemIcon, ListItemText } from '@mui/material';
import { EllipsisVerticalIcon, EyeIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';

export default function RowActionsMenu({ onView, onEdit, onDelete }: { onView?: ()=>void; onEdit?: ()=>void; onDelete?: ()=>void; }) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const { t } = useTranslation('common');
  return (<>
    <IconButton aria-label={t('actions.actions')} onClick={(e)=>setAnchorEl(e.currentTarget)} size="small"><EllipsisVerticalIcon className="h-5 w-5" /></IconButton>
    <Menu anchorEl={anchorEl} open={open} onClose={()=>setAnchorEl(null)}>
      {onView && (<MenuItem onClick={()=>{ setAnchorEl(null); onView(); }}><ListItemIcon><EyeIcon className="h-5 w-5" /></ListItemIcon><ListItemText>{t('actions.view')}</ListItemText></MenuItem>)}
      {onEdit && (<MenuItem onClick={()=>{ setAnchorEl(null); onEdit(); }}><ListItemIcon><PencilSquareIcon className="h-5 w-5" /></ListItemIcon><ListItemText>{t('actions.edit')}</ListItemText></MenuItem>)}
      {onDelete && (<MenuItem onClick={()=>{ setAnchorEl(null); onDelete(); }}><ListItemIcon><TrashIcon className="h-5 w-5" /></ListItemIcon><ListItemText>{t('actions.delete')}</ListItemText></MenuItem>)}
    </Menu>
  </>);
}

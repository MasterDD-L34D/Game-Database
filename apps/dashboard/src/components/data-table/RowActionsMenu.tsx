
import { useState } from 'react';
import { IconButton, Menu, MenuItem, ListItemIcon, ListItemText } from '@mui/material';
import { EllipsisVerticalIcon, EyeIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';

export default function RowActionsMenu({ onView, onEdit, onDelete }: { onView?: ()=>void; onEdit?: ()=>void; onDelete?: ()=>void; }) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  return (<>
    <IconButton aria-label="Azioni" onClick={(e)=>setAnchorEl(e.currentTarget)} size="small"><EllipsisVerticalIcon className="h-5 w-5" /></IconButton>
    <Menu anchorEl={anchorEl} open={open} onClose={()=>setAnchorEl(null)}>
      {onView && (<MenuItem onClick={()=>{ setAnchorEl(null); onView(); }}><ListItemIcon><EyeIcon className="h-5 w-5" /></ListItemIcon><ListItemText>Dettagli</ListItemText></MenuItem>)}
      {onEdit && (<MenuItem onClick={()=>{ setAnchorEl(null); onEdit(); }}><ListItemIcon><PencilSquareIcon className="h-5 w-5" /></ListItemIcon><ListItemText>Modifica</ListItemText></MenuItem>)}
      {onDelete && (<MenuItem onClick={()=>{ setAnchorEl(null); onDelete(); }}><ListItemIcon><TrashIcon className="h-5 w-5" /></ListItemIcon><ListItemText>Elimina</ListItemText></MenuItem>)}
    </Menu>
  </>);
}

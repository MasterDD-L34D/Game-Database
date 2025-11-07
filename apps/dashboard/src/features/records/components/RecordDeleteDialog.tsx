import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';
import type { RecordRow } from '../../../types/record';
import { useDeleteRecordsMutation } from '../api/useDeleteRecordsMutation';

interface RecordDeleteDialogProps {
  open: boolean;
  records: RecordRow[];
  onClose: () => void;
  onDeleted?: () => void;
  mutation: ReturnType<typeof useDeleteRecordsMutation>;
}

export default function RecordDeleteDialog({ open, records, onClose, onDeleted, mutation }: RecordDeleteDialogProps) {
  const count = records.length;
  const disabled = mutation.isPending;

  const description = count === 1
    ? `Sei sicuro di voler eliminare “${records[0]?.nome ?? 'questo record'}”?`
    : `Sei sicuro di voler eliminare ${count} record? L'operazione non può essere annullata.`;

  const namesPreview = count > 1 ? records.slice(0, 3).map((record) => record.nome).filter(Boolean) : [];

  async function handleConfirm() {
    if (!records.length) return;
    try {
      const payload = records
        .map((record) => ({ id: record.id, nome: record.nome }))
        .filter((record): record is { id: string; nome?: string } => Boolean(record.id));
      if (!payload.length) {
        onClose();
        return;
      }
      await mutation.mutateAsync(payload);
      onDeleted?.();
      onClose();
    } catch (error) {
      // Gli errori vengono già gestiti dalla mutation con un toast.
    }
  }

  return (
    <Dialog open={open} onClose={disabled ? undefined : onClose} aria-labelledby="record-delete-dialog-title">
      <DialogTitle id="record-delete-dialog-title">Conferma eliminazione</DialogTitle>
      <DialogContent>
        <Typography>{description}</Typography>
        {namesPreview.length > 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {namesPreview.join(', ')}{count > namesPreview.length ? '…' : ''}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={disabled}>Annulla</Button>
        <Button color="error" variant="contained" onClick={handleConfirm} disabled={disabled}>
          {disabled ? 'Eliminazione...' : 'Elimina'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

import { useMutation } from '@tanstack/react-query';
import { deleteRecord } from '../../../lib/records';
import { useSnackbar } from '../../../components/SnackbarProvider';
import type { RecordRow } from '../../../types/record';

type TargetRecord = Pick<RecordRow, 'id' | 'nome'>;

export function useDeleteRecordsMutation() {
  const { enqueueSnackbar } = useSnackbar();

  return useMutation<void, unknown, TargetRecord[]>({
    mutationFn: async (records) => {
      const ids = records.map((record) => record.id).filter((id): id is string => Boolean(id));
      await Promise.all(ids.map((id) => deleteRecord(id)));
    },
    onSuccess: (_data, records) => {
      const count = records.length;
      const message = count === 1 ? 'Record eliminato con successo.' : `${count} record eliminati con successo.`;
      enqueueSnackbar(message, { variant: 'success' });
    },
    onError: (error) => {
      console.error('Errore durante l\'eliminazione dei record:', error);
      enqueueSnackbar('Si è verificato un errore durante l\'eliminazione.', { variant: 'error' });
    },
  });
}

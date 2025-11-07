import RowActionsMenu from '../../../components/data-table/RowActionsMenu';
import type { RecordRow } from '../../../types/record';
import { useNavigate } from 'react-router-dom';

type Props = {
  record: RecordRow;
  onDelete?: (record: RecordRow) => void;
};

export default function RecordRowActions({ record, onDelete }: Props) {
  const navigate = useNavigate();
  const id = record.id;

  return (
    <RowActionsMenu
      onView={id ? () => navigate(`/records/${id}`) : undefined}
      onEdit={id ? () => navigate(`/records/${id}/edit`) : undefined}
      onDelete={id && onDelete ? () => onDelete(record) : undefined}
    />
  );
}

import { Chip } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { VersionStatus } from '../../../lib/taxonomy';

const COLOR: Record<VersionStatus, 'default' | 'success' | 'warning'> = {
  draft: 'warning',
  released: 'success',
  retired: 'default',
};

export default function VersionStatusChip({ status }: { status: VersionStatus }) {
  const { t } = useTranslation('versions');
  return <Chip size="small" color={COLOR[status]} label={t(`versions.status.${status}`)} />;
}

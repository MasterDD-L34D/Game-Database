import { Button, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { TaxonomyVersion } from '../../../lib/taxonomy';
import VersionStatusChip from './VersionStatusChip';

type Props = {
  versions: TaxonomyVersion[];
  busy: boolean;
  onRelease: (v: TaxonomyVersion) => void;
  onRetire: (v: TaxonomyVersion) => void;
  onDelete: (v: TaxonomyVersion) => void;
  onDetails: (v: TaxonomyVersion) => void;
};

function formatDate(value?: string | null) {
  if (!value) return '-';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString();
}

export default function VersionTable({ versions, busy, onRelease, onRetire, onDelete, onDetails }: Props) {
  const { t } = useTranslation('versions');
  if (versions.length === 0) {
    return <Typography color="text.secondary">{t('versions.empty')}</Typography>;
  }
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>{t('versions.columns.tag')}</TableCell>
          <TableCell>{t('versions.columns.status')}</TableCell>
          <TableCell>{t('versions.columns.releasedAt')}</TableCell>
          <TableCell>{t('versions.columns.description')}</TableCell>
          <TableCell align="right">{t('versions.columns.actions')}</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {versions.map((v) => (
          <TableRow key={v.id}>
            <TableCell>{v.tag}</TableCell>
            <TableCell><VersionStatusChip status={v.status} /></TableCell>
            <TableCell>{formatDate(v.releasedAt)}</TableCell>
            <TableCell>{v.description ?? ''}</TableCell>
            <TableCell align="right">
              <Stack direction="row" spacing={1} justifyContent="flex-end">
                {v.status === 'draft' && (
                  <Button size="small" variant="contained" disabled={busy} onClick={() => onRelease(v)}>
                    {t('versions.actions.release')}
                  </Button>
                )}
                {v.status === 'released' && (
                  <Button size="small" variant="outlined" disabled={busy} onClick={() => onRetire(v)}>
                    {t('versions.actions.retire')}
                  </Button>
                )}
                <Button size="small" variant="text" disabled={busy} onClick={() => onDetails(v)}>
                  {t('versions.actions.details')}
                </Button>
                {v.status === 'draft' && (
                  <Button size="small" color="error" variant="text" disabled={busy} onClick={() => onDelete(v)}>
                    {t('versions.actions.delete')}
                  </Button>
                )}
              </Stack>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

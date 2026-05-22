import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getTaxonomyVersion } from '../../../lib/taxonomy';

type Props = { open: boolean; tag: string | null; onClose: () => void };

export default function VersionDetailDialog({ open, tag, onClose }: Props) {
  const { t } = useTranslation('versions');
  const { data } = useQuery({
    queryKey: ['taxonomy-version', tag],
    queryFn: () => getTaxonomyVersion(tag as string),
    enabled: open && Boolean(tag),
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{t('versions.detail.title')}</DialogTitle>
      <DialogContent>
        {data && (
          <Stack spacing={1} sx={{ mt: 1 }}>
            <Typography><strong>{t('versions.columns.tag')}:</strong> {data.version.tag}</Typography>
            <Typography><strong>{t('versions.columns.status')}:</strong> {t(`versions.status.${data.version.status}`)}</Typography>
            <Typography><strong>{t('versions.detail.releasedBy')}:</strong> {data.version.releasedBy ?? '-'}</Typography>
            <Typography><strong>{t('versions.columns.description')}:</strong> {data.version.description ?? ''}</Typography>
            <Typography variant="subtitle2" sx={{ mt: 1 }}>{t('versions.detail.counts')}</Typography>
            <Typography>{t('versions.detail.trait')}: <span>{data.counts.trait}</span></Typography>
            <Typography>{t('versions.detail.biome')}: <span>{data.counts.biome}</span></Typography>
            <Typography>{t('versions.detail.species')}: <span>{data.counts.species}</span></Typography>
            <Typography>{t('versions.detail.ecosystem')}: <span>{data.counts.ecosystem}</span></Typography>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('versions.confirm.cancel')}</Button>
      </DialogActions>
    </Dialog>
  );
}

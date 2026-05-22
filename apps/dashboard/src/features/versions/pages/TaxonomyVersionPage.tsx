import { useCallback, useState } from 'react';
import {
  Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControlLabel, Paper, Stack, Switch, Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../../../lib/api';
import {
  createTaxonomyVersion, deleteTaxonomyVersion, listTaxonomyVersions,
  releaseTaxonomyVersion, retireTaxonomyVersion, type TaxonomyVersion,
} from '../../../lib/taxonomy';
import { useSnackbar } from '../../../components/SnackbarProvider';
import VersionTable from '../components/VersionTable';
import CreateVersionDialog from '../components/CreateVersionDialog';
import VersionDetailDialog from '../components/VersionDetailDialog';

type Confirm = { kind: 'release' | 'retire' | 'delete'; version: TaxonomyVersion } | null;

export default function TaxonomyVersionPage() {
  const { t } = useTranslation('versions');
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();
  const [includeRetired, setIncludeRetired] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailTag, setDetailTag] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['taxonomy-versions', { includeRetired }],
    queryFn: () => listTaxonomyVersions(includeRetired),
  });

  const errorMessage = useCallback(
    (err: unknown) => {
      const code = err instanceof ApiError ? err.code : undefined;
      const key = code ? `versions.errors.${code}` : 'versions.errors.generic';
      const msg = t(key);
      return msg === key ? t('versions.errors.generic') : msg;
    },
    [t],
  );

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ['taxonomy-versions'], exact: false }),
    [queryClient],
  );

  const createMut = useMutation({
    mutationFn: (body: { tag: string; description?: string }) => createTaxonomyVersion(body),
    onSuccess: async () => { setCreateOpen(false); enqueueSnackbar(t('versions.feedback.created'), { variant: 'success' }); await invalidate(); },
    onError: (err) => enqueueSnackbar(errorMessage(err), { variant: 'error' }),
  });

  const releaseMut = useMutation({
    mutationFn: (tag: string) => releaseTaxonomyVersion(tag),
    onSuccess: async () => { setConfirm(null); enqueueSnackbar(t('versions.feedback.released'), { variant: 'success' }); await invalidate(); },
    onError: (err) => enqueueSnackbar(errorMessage(err), { variant: 'error' }),
  });

  const retireMut = useMutation({
    mutationFn: (tag: string) => retireTaxonomyVersion(tag),
    onSuccess: async () => { setConfirm(null); enqueueSnackbar(t('versions.feedback.retired'), { variant: 'success' }); await invalidate(); },
    onError: (err) => enqueueSnackbar(errorMessage(err), { variant: 'error' }),
  });

  const deleteMut = useMutation({
    mutationFn: (tag: string) => deleteTaxonomyVersion(tag),
    onSuccess: async () => { setConfirm(null); enqueueSnackbar(t('versions.feedback.deleted'), { variant: 'success' }); await invalidate(); },
    onError: (err) => enqueueSnackbar(errorMessage(err), { variant: 'error' }),
  });

  const busy = createMut.isPending || releaseMut.isPending || retireMut.isPending || deleteMut.isPending;

  const onConfirm = useCallback(() => {
    if (!confirm) return;
    if (confirm.kind === 'release') releaseMut.mutate(confirm.version.tag);
    else if (confirm.kind === 'retire') retireMut.mutate(confirm.version.tag);
    else deleteMut.mutate(confirm.version.tag);
  }, [confirm, releaseMut, retireMut, deleteMut]);

  const confirmText = confirm
    ? { title: t(`versions.confirm.${confirm.kind}Title`), body: t(`versions.confirm.${confirm.kind}Body`, { tag: confirm.version.tag }) }
    : { title: '', body: '' };

  return (
    <Paper sx={(theme) => ({ padding: theme.layout.cardPadding, boxShadow: theme.customShadows.card })}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }} sx={(theme) => ({ mb: theme.spacing(4) })}>
        <Typography variant="h6">{t('versions.title')}</Typography>
        <Box sx={{ flexGrow: 1 }} />
        <FormControlLabel
          control={<Switch checked={includeRetired} onChange={(e) => setIncludeRetired(e.target.checked)} />}
          label={t('versions.includeRetired')}
        />
        <Button variant="contained" onClick={() => setCreateOpen(true)} disabled={busy}>
          {t('versions.actions.create')}
        </Button>
      </Stack>

      {isError ? (
        <Alert severity="error">{t('versions.errors.loadFailed')}</Alert>
      ) : isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
      ) : (
        <VersionTable
          versions={data?.versions ?? []}
          busy={busy}
          onRelease={(v) => setConfirm({ kind: 'release', version: v })}
          onRetire={(v) => setConfirm({ kind: 'retire', version: v })}
          onDelete={(v) => setConfirm({ kind: 'delete', version: v })}
          onDetails={(v) => setDetailTag(v.tag)}
        />
      )}

      <CreateVersionDialog open={createOpen} onClose={() => setCreateOpen(false)} onSubmit={async (body) => { createMut.mutate(body); }} submitting={createMut.isPending} />
      <VersionDetailDialog open={Boolean(detailTag)} tag={detailTag} onClose={() => setDetailTag(null)} />

      <Dialog open={Boolean(confirm)} onClose={() => !busy && setConfirm(null)} fullWidth maxWidth="xs">
        <DialogTitle>{confirmText.title}</DialogTitle>
        <DialogContent><Typography>{confirmText.body}</Typography></DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(null)} disabled={busy}>{t('versions.confirm.cancel')}</Button>
          <Button variant="contained" color={confirm?.kind === 'delete' ? 'error' : 'primary'} onClick={onConfirm} disabled={busy}>
            {t('versions.confirm.confirm')}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}

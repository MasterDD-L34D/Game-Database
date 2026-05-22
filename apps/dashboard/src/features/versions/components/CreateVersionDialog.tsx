import { useEffect } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField } from '@mui/material';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

const SEMVER_RE = /^v\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;

type FormValues = { tag: string; description: string };

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (body: { tag: string; description?: string }) => Promise<void>;
  submitting: boolean;
};

export default function CreateVersionDialog({ open, onClose, onSubmit, submitting }: Props) {
  const { t } = useTranslation('versions');
  const { control, handleSubmit, reset, formState } = useForm<FormValues>({ defaultValues: { tag: '', description: '' } });

  useEffect(() => {
    if (open) reset({ tag: '', description: '' });
  }, [open, reset]);

  const submit = handleSubmit(async (values) => {
    const description = values.description.trim();
    await onSubmit({ tag: values.tag.trim(), ...(description ? { description } : {}) });
  });

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('versions.create.title')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Controller
            name="tag"
            control={control}
            rules={{ validate: (v) => SEMVER_RE.test(v.trim()) || t('versions.create.invalidTag') }}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                label={t('versions.create.tag')}
                fullWidth
                autoFocus
                error={Boolean(fieldState.error)}
                helperText={fieldState.error?.message}
                disabled={submitting}
              />
            )}
          />
          <Controller
            name="description"
            control={control}
            render={({ field }) => (
              <TextField {...field} label={t('versions.create.description')} fullWidth multiline minRows={2} disabled={submitting} />
            )}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>{t('versions.confirm.cancel')}</Button>
        <Button variant="contained" onClick={submit} disabled={submitting || formState.isSubmitting}>
          {t('versions.create.submit')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

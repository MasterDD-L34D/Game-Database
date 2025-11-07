import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Breadcrumbs,
  Button,
  Grid,
  LinearProgress,
  Link as MuiLink,
  MenuItem,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getRecord, updateRecord } from '../../../lib/records';
import type { RecordRow, Curvatura, Pattern, Peso, Stile } from '../../../types/record';

const statoOptions: RecordRow['stato'][] = ['Attivo', 'Bozza', 'Archiviato'];
const stileOptions: (Stile | '')[] = ['', 'Monolinea', 'Tratteggiato', 'Puntinato', 'Brush', 'Calligrafico', 'Geometrico', 'Organico', 'DoppioTratto', 'Ombreggiato', 'Tecnico', 'Neon', 'Sfumato', 'Angolare', 'Spezzato', 'Contour', 'Ink'];
const patternOptions: (Pattern | '')[] = ['', 'Pieno', 'Tratteggio', 'Puntinato', 'Gradiente', 'Hachure', 'Contorno', 'Spezzato', 'Inchiostro'];
const pesoOptions: (Peso | '')[] = ['', 'Sottile', 'Medio', 'Spesso', 'Variabile'];
const curvaturaOptions: (Curvatura | '')[] = ['', 'Lineare', 'Curvo', 'Organico', 'Angolare'];

type FormValues = {
  nome: string;
  stato: RecordRow['stato'];
  descrizione: string;
  data: string;
  stile: string;
  pattern: string;
  peso: string;
  curvatura: string;
};

function normalizePatch(values: FormValues): Partial<RecordRow> {
  return {
    nome: values.nome,
    stato: values.stato,
    descrizione: values.descrizione.trim() ? values.descrizione.trim() : undefined,
    data: values.data.trim() ? values.data : undefined,
    stile: values.stile ? (values.stile as Stile) : undefined,
    pattern: values.pattern ? (values.pattern as Pattern) : undefined,
    peso: values.peso ? (values.peso as Peso) : undefined,
    curvatura: values.curvatura ? (values.curvatura as Curvatura) : undefined,
  } satisfies Partial<RecordRow>;
}

export default function RecordEditPage() {
  const navigate = useNavigate();
  const { recordId } = useParams<{ recordId: string }>();
  const queryClient = useQueryClient();
  const [successOpen, setSuccessOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { t } = useTranslation(['records', 'common', 'navigation']);

  const {
    data,
    error,
    isError,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['records', 'detail', recordId],
    queryFn: () => getRecord(recordId ?? ''),
    enabled: Boolean(recordId),
  });

  const record = data as RecordRow | undefined;

  const defaultValues = useMemo<FormValues>(
    () => ({
      nome: record?.nome ?? '',
      stato: record?.stato ?? 'Bozza',
      descrizione: record?.descrizione ?? '',
      data: record?.data ?? '',
      stile: record?.stile ?? '',
      pattern: record?.pattern ?? '',
      peso: record?.peso ?? '',
      curvatura: record?.curvatura ?? '',
    }),
    [record],
  );

  const {
    handleSubmit,
    register,
    reset,
  } = useForm<FormValues>({
    defaultValues: {
      nome: '',
      stato: 'Bozza',
      descrizione: '',
      data: '',
      stile: '',
      pattern: '',
      peso: '',
      curvatura: '',
    },
  });

  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  const mutation = useMutation({
    mutationFn: (patch: Partial<RecordRow>) => updateRecord(recordId ?? '', patch),
    onSuccess: (updated) => {
      if (recordId) {
        queryClient.setQueryData(['records', 'detail', recordId], updated);
        queryClient.invalidateQueries({ queryKey: ['records'] });
      }
      setSubmitError(null);
      setSuccessOpen(true);
    },
    onError: (err: unknown) => {
      setSubmitError(err instanceof Error ? err.message : t('records:edit.error'));
    },
  });

  const onSubmit = handleSubmit((values) => {
    if (!recordId) return;
    setSubmitError(null);
    mutation.mutate(normalizePatch(values));
  });

  const breadcrumbLabel = record?.nome ?? (isLoading ? t('common:status.loading') : t('records:edit.breadcrumb'));

  return (
    <Stack spacing={3} component="section" aria-live="polite">
      <Breadcrumbs aria-label="breadcrumb">
        <MuiLink component={RouterLink} color="inherit" to="/">
          {t('navigation:dashboard')}
        </MuiLink>
        <MuiLink component={RouterLink} color="inherit" to="/records">
          {t('records:common.records')}
        </MuiLink>
        <MuiLink component={RouterLink} color="inherit" to={recordId ? `/records/${recordId}` : '/records'}>
          {breadcrumbLabel}
        </MuiLink>
        <Typography color="text.primary">{t('records:edit.breadcrumb')}</Typography>
      </Breadcrumbs>

      {!recordId ? (
        <Paper className="p-4">
          <Stack spacing={2}>
            <Alert severity="error">{t('records:edit.invalidId')}</Alert>
            <div>
              <Button variant="contained" onClick={() => navigate('/records')}>
                {t('common:actions.backToList')}
              </Button>
            </div>
          </Stack>
        </Paper>
      ) : (
        <Paper className="p-4">
          <Stack spacing={3}>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={2}
              alignItems={{ xs: 'flex-start', md: 'center' }}
            >
              <div className="flex-1">
                <Typography variant="h5" component="h1">
                  {t('records:edit.title')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('records:edit.subtitle')}
                </Typography>
              </div>
              <Stack direction="row" spacing={1} justifyContent="flex-end" flexWrap="wrap">
                <Button variant="outlined" onClick={() => navigate(recordId ? `/records/${recordId}` : '/records')}>
                  {t('common:actions.cancel')}
                </Button>
                <Button
                  type="submit"
                  form="record-edit-form"
                  variant="contained"
                  disabled={mutation.isPending || isLoading || isFetching}
                >
                  {t('common:actions.saveChanges')}
                </Button>
              </Stack>
            </Stack>

            {(isLoading || isFetching) && <LinearProgress aria-label={t('records:edit.loading')} />}

            {isError ? (
              <Alert
                severity="error"
                action={
                  <Button color="inherit" size="small" onClick={() => refetch()}>
                    {t('common:actions.retry')}
                  </Button>
                }
              >
                {error instanceof Error ? error.message : t('common:feedback.recordLoadError')}
              </Alert>
            ) : null}

            {!isLoading && !isError ? (
              <form id="record-edit-form" onSubmit={onSubmit} noValidate>
                <Stack spacing={3}>
                  {submitError ? <Alert severity="error">{submitError}</Alert> : null}
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <TextField
                        label={t('records:edit.fields.name.label')}
                        placeholder={t('records:edit.fields.name.placeholder')}
                        fullWidth
                        required
                        disabled={mutation.isPending}
                        {...register('nome', { required: true })}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        label={t('records:edit.fields.status')}
                        select
                        fullWidth
                        disabled={mutation.isPending}
                        {...register('stato')}
                      >
                        {statoOptions.map((option) => (
                          <MenuItem key={option} value={option}>
                            {option}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        label={t('records:edit.fields.description.label')}
                        placeholder={t('records:edit.fields.description.placeholder')}
                        fullWidth
                        multiline
                        minRows={3}
                        disabled={mutation.isPending}
                        {...register('descrizione')}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        label={t('records:edit.fields.date')}
                        type="date"
                        fullWidth
                        InputLabelProps={{ shrink: true }}
                        disabled={mutation.isPending}
                        {...register('data')}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        label={t('records:edit.fields.style')}
                        select
                        fullWidth
                        disabled={mutation.isPending}
                        {...register('stile')}
                      >
                        {stileOptions.map((option) => (
                          <MenuItem key={option || 'none'} value={option}>
                            {option || t('records:edit.emptyOption')}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        label={t('records:edit.fields.pattern')}
                        select
                        fullWidth
                        disabled={mutation.isPending}
                        {...register('pattern')}
                      >
                        {patternOptions.map((option) => (
                          <MenuItem key={option || 'none'} value={option}>
                            {option || t('records:edit.emptyOption')}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        label={t('records:edit.fields.weight')}
                        select
                        fullWidth
                        disabled={mutation.isPending}
                        {...register('peso')}
                      >
                        {pesoOptions.map((option) => (
                          <MenuItem key={option || 'none'} value={option}>
                            {option || t('records:edit.emptyOption')}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        label={t('records:edit.fields.curvature')}
                        select
                        fullWidth
                        disabled={mutation.isPending}
                        {...register('curvatura')}
                      >
                        {curvaturaOptions.map((option) => (
                          <MenuItem key={option || 'none'} value={option}>
                            {option || t('records:edit.emptyOption')}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Grid>
                  </Grid>
                </Stack>
              </form>
            ) : null}
          </Stack>
        </Paper>
      )}

      <Snackbar
        open={successOpen}
        autoHideDuration={2500}
        onClose={() => setSuccessOpen(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert onClose={() => setSuccessOpen(false)} severity="success" variant="filled" sx={{ width: '100%' }}>
          {t('records:edit.success')}
        </Alert>
      </Snackbar>
    </Stack>
  );
}

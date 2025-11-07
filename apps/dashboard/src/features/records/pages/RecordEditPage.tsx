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
      setSubmitError(err instanceof Error ? err.message : 'Errore durante il salvataggio.');
    },
  });

  const onSubmit = handleSubmit((values) => {
    if (!recordId) return;
    setSubmitError(null);
    mutation.mutate(normalizePatch(values));
  });

  const breadcrumbLabel = record?.nome ?? (isLoading ? 'Caricamento…' : 'Modifica');

  return (
    <Stack spacing={3} component="section" aria-live="polite">
      <Breadcrumbs aria-label="breadcrumb">
        <MuiLink component={RouterLink} color="inherit" to="/">
          Dashboard
        </MuiLink>
        <MuiLink component={RouterLink} color="inherit" to="/records">
          Record
        </MuiLink>
        <MuiLink component={RouterLink} color="inherit" to={recordId ? `/records/${recordId}` : '/records'}>
          {breadcrumbLabel}
        </MuiLink>
        <Typography color="text.primary">Modifica</Typography>
      </Breadcrumbs>

      {!recordId ? (
        <Paper className="p-4">
          <Stack spacing={2}>
            <Alert severity="error">Identificativo record non valido.</Alert>
            <div>
              <Button variant="contained" onClick={() => navigate('/records')}>
                Torna all'elenco
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
                  Modifica record
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Aggiorna le informazioni del record esistente.
                </Typography>
              </div>
              <Stack direction="row" spacing={1} justifyContent="flex-end" flexWrap="wrap">
                <Button variant="outlined" onClick={() => navigate(recordId ? `/records/${recordId}` : '/records')}>
                  Annulla
                </Button>
                <Button
                  type="submit"
                  form="record-edit-form"
                  variant="contained"
                  disabled={mutation.isPending || isLoading || isFetching}
                >
                  Salva modifiche
                </Button>
              </Stack>
            </Stack>

            {(isLoading || isFetching) && <LinearProgress aria-label="Caricamento record" />}

            {isError ? (
              <Alert
                severity="error"
                action={
                  <Button color="inherit" size="small" onClick={() => refetch()}>
                    Riprova
                  </Button>
                }
              >
                {error instanceof Error ? error.message : 'Impossibile caricare il record.'}
              </Alert>
            ) : null}

            {!isLoading && !isError ? (
              <form id="record-edit-form" onSubmit={onSubmit} noValidate>
                <Stack spacing={3}>
                  {submitError ? <Alert severity="error">{submitError}</Alert> : null}
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <TextField
                        label="Nome"
                        placeholder="Inserisci il nome"
                        fullWidth
                        required
                        disabled={mutation.isPending}
                        {...register('nome', { required: true })}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        label="Stato"
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
                        label="Descrizione"
                        placeholder="Aggiungi una descrizione"
                        fullWidth
                        multiline
                        minRows={3}
                        disabled={mutation.isPending}
                        {...register('descrizione')}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        label="Data"
                        type="date"
                        fullWidth
                        InputLabelProps={{ shrink: true }}
                        disabled={mutation.isPending}
                        {...register('data')}
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        label="Stile"
                        select
                        fullWidth
                        disabled={mutation.isPending}
                        {...register('stile')}
                      >
                        {stileOptions.map((option) => (
                          <MenuItem key={option || 'none'} value={option}>
                            {option || '—'}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        label="Pattern"
                        select
                        fullWidth
                        disabled={mutation.isPending}
                        {...register('pattern')}
                      >
                        {patternOptions.map((option) => (
                          <MenuItem key={option || 'none'} value={option}>
                            {option || '—'}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        label="Peso"
                        select
                        fullWidth
                        disabled={mutation.isPending}
                        {...register('peso')}
                      >
                        {pesoOptions.map((option) => (
                          <MenuItem key={option || 'none'} value={option}>
                            {option || '—'}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        label="Curvatura"
                        select
                        fullWidth
                        disabled={mutation.isPending}
                        {...register('curvatura')}
                      >
                        {curvaturaOptions.map((option) => (
                          <MenuItem key={option || 'none'} value={option}>
                            {option || '—'}
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
          Record aggiornato con successo.
        </Alert>
      </Snackbar>
    </Stack>
  );
}

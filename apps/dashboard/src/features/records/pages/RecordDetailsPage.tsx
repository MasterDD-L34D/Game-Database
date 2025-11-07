import { useMemo } from 'react';
import {
  Alert,
  Breadcrumbs,
  Button,
  Grid,
  LinearProgress,
  Link as MuiLink,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getRecord } from '../../../lib/records';
import type { RecordRow } from '../../../types/record';
import { df } from '../../../lib/formatters';

function formatDate(value?: string | null) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return df.format(parsed);
}

function formatText(value?: string | null) {
  if (value == null || value === '') return '—';
  return value;
}

type DetailItem = { label: string; value: string };

export default function RecordDetailsPage() {
  const navigate = useNavigate();
  const { recordId } = useParams<{ recordId: string }>();

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

  const infoItems = useMemo<DetailItem[]>(() => {
    if (!record) return [];
    return [
      { label: 'Stato', value: formatText(record.stato) },
      { label: 'Descrizione', value: formatText(record.descrizione) },
      { label: 'Data', value: formatDate(record.data) },
      { label: 'Stile', value: formatText(record.stile) },
      { label: 'Pattern', value: formatText(record.pattern) },
      { label: 'Peso', value: formatText(record.peso) },
      { label: 'Curvatura', value: formatText(record.curvatura) },
      { label: 'Creato da', value: formatText(record.createdBy) },
      { label: 'Aggiornato da', value: formatText(record.updatedBy) },
      { label: 'Creato il', value: formatDate(record.createdAt) },
      { label: 'Aggiornato il', value: formatDate(record.updatedAt) },
    ];
  }, [record]);

  const breadcrumbLabel = record?.nome ?? (isLoading ? 'Caricamento…' : 'Dettagli');

  return (
    <Stack spacing={3}>
      <Breadcrumbs aria-label="breadcrumb">
        <MuiLink component={RouterLink} color="inherit" to="/">
          Dashboard
        </MuiLink>
        <MuiLink component={RouterLink} color="inherit" to="/records">
          Record
        </MuiLink>
        <Typography color="text.primary">{breadcrumbLabel}</Typography>
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
        <Paper className="p-4" role="region" aria-live="polite">
          <Stack spacing={3}>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={2}
              alignItems={{ xs: 'flex-start', md: 'center' }}
            >
              <div className="flex-1">
                <Typography variant="h5" component="h1">
                  {record?.nome ?? 'Dettagli record'}
                </Typography>
                {record?.updatedAt ? (
                  <Typography variant="body2" color="text.secondary">
                    Aggiornato il {formatDate(record.updatedAt)}
                  </Typography>
                ) : null}
              </div>
              <Stack direction="row" spacing={1} justifyContent="flex-end" flexWrap="wrap">
                <Button variant="outlined" onClick={() => navigate('/records')}>
                  Torna all'elenco
                </Button>
                <Button
                  variant="contained"
                  onClick={() => navigate(`/records/${recordId}/edit`)}
                  disabled={isLoading || isFetching || isError}
                >
                  Modifica
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

            {!isLoading && !isError && record ? (
              <Grid container spacing={2}>
                {infoItems.map((item) => (
                  <Grid item xs={12} md={6} key={item.label}>
                    <Typography variant="subtitle2" color="text.secondary">
                      {item.label}
                    </Typography>
                    <Typography variant="body1">{item.value}</Typography>
                  </Grid>
                ))}
              </Grid>
            ) : null}
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}

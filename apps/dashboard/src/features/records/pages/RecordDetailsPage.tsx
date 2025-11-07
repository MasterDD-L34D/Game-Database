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
import { useTranslation } from 'react-i18next';
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

  const infoItems = useMemo<DetailItem[]>(() => {
    if (!record) return [];
    return [
      { label: t('records:common.fields.status'), value: formatText(record.stato) },
      { label: t('records:common.fields.description'), value: formatText(record.descrizione) },
      { label: t('records:common.fields.date'), value: formatDate(record.data) },
      { label: t('records:common.fields.style'), value: formatText(record.stile) },
      { label: t('records:common.fields.pattern'), value: formatText(record.pattern) },
      { label: t('records:common.fields.weight'), value: formatText(record.peso) },
      { label: t('records:common.fields.curvature'), value: formatText(record.curvatura) },
      { label: t('records:common.fields.createdBy'), value: formatText(record.createdBy) },
      { label: t('records:common.fields.updatedBy'), value: formatText(record.updatedBy) },
      { label: t('records:common.fields.createdAt'), value: formatDate(record.createdAt) },
      { label: t('records:common.fields.updatedAt'), value: formatDate(record.updatedAt) },
    ];
  }, [record, t]);

  const breadcrumbLabel = record?.nome ?? (isLoading ? t('common:status.loading') : t('records:details.breadcrumbFallback'));

  return (
    <Stack spacing={3}>
      <Breadcrumbs aria-label="breadcrumb">
        <MuiLink component={RouterLink} color="inherit" to="/">
          {t('navigation:dashboard')}
        </MuiLink>
        <MuiLink component={RouterLink} color="inherit" to="/records">
          {t('records:common.records')}
        </MuiLink>
        <Typography color="text.primary">{breadcrumbLabel}</Typography>
      </Breadcrumbs>

      {!recordId ? (
        <Paper className="p-4">
          <Stack spacing={2}>
            <Alert severity="error">{t('records:details.invalidId')}</Alert>
            <div>
              <Button variant="contained" onClick={() => navigate('/records')}>
                {t('common:actions.backToList')}
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
                  {record?.nome ?? t('records:details.titleFallback')}
                </Typography>
                {record?.updatedAt ? (
                  <Typography variant="body2" color="text.secondary">
                    {t('records:details.updatedAt', { date: formatDate(record.updatedAt) })}
                  </Typography>
                ) : null}
              </div>
              <Stack direction="row" spacing={1} justifyContent="flex-end" flexWrap="wrap">
                <Button variant="outlined" onClick={() => navigate('/records')}>
                  {t('common:actions.backToList')}
                </Button>
                <Button
                  variant="contained"
                  onClick={() => navigate(`/records/${recordId}/edit`)}
                  disabled={isLoading || isFetching || isError}
                >
                  {t('common:actions.edit')}
                </Button>
              </Stack>
            </Stack>

            {(isLoading || isFetching) && <LinearProgress aria-label={t('records:details.loading')} />}

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

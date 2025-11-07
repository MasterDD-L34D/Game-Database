
import { Alert, Button, Card, CardContent, Grid, Skeleton, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useDashboardStats } from '../features/dashboard/hooks';

export default function DashboardPage() {
  const { data, isLoading, isError, error, refetch } = useDashboardStats();
  const { t } = useTranslation(['dashboard', 'common']);

  const metrics = useMemo(
    () => [
      { key: 'totalRecords', label: t('dashboard:metrics.totalRecords') },
      { key: 'newRecords', label: t('dashboard:metrics.newRecords') },
      { key: 'errorRecords', label: t('dashboard:metrics.errorRecords') },
    ] as const,
    [t],
  );

  const stats = useMemo(() => {
    return metrics.map((metric) => {
      const raw = data?.[metric.key];
      return {
        ...metric,
        value: raw?.value ?? null,
        trend: raw?.trend ?? undefined,
      };
    });
  }, [data, metrics]);

  return (
    <Stack sx={(theme) => ({ gap: theme.layout.sectionGap })}>
      {isError ? (
        <Alert
          severity="error"
          sx={(theme) => ({
            boxShadow: theme.customShadows.card,
          })}
          action={
            <Button color="inherit" size="small" onClick={() => refetch()}>
              {t('common:actions.retry')}
            </Button>
          }
        >
          {error?.message || t('dashboard:errors.loadFailed')}
        </Alert>
      ) : null}

      <Grid container spacing={3}>
        {stats.map((s) => (
          <Grid item key={s.key} xs={12} md={6} lg={4}>
            <Card
              sx={(theme) => ({
                height: '100%',
                boxShadow: theme.customShadows.card,
                background: `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.04)}, ${theme.palette.background.paper})`,
              })}
            >
              <CardContent sx={(theme) => ({ display: 'flex', flexDirection: 'column', gap: theme.spacing(1.5) })}>
                <Typography variant="body2" color="text.secondary">
                  {s.label}
                </Typography>
                {isLoading ? (
                  <Skeleton variant="text" width="60%" height={40} sx={{ mt: 0.5 }} />
                ) : (
                  <Typography variant="h4" sx={{ fontWeight: 700 }}>
                    {s.value != null ? s.value.toLocaleString('it-IT') : t('common:generic.notAvailable')}
                  </Typography>
                )}
                {isLoading ? (
                  <Skeleton variant="text" width="40%" height={20} />
                ) : s.trend ? (
                  <Typography
                    variant="caption"
                    sx={(theme) => ({
                      color: s.trend.startsWith('-') ? theme.palette.error.main : theme.palette.success.main,
                      fontWeight: 600,
                    })}
                  >
                    {s.trend}
                  </Typography>
                ) : null}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Stack>
  );
}

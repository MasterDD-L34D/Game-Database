
import { Alert, Button, Card, CardContent, Skeleton, Stack, Typography } from '@mui/material';
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
    <Stack spacing={3}>
      {isError ? (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => refetch()}>
              {t('common:actions.retry')}
            </Button>
          }
        >
          {error?.message || t('dashboard:errors.loadFailed')}
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => (
          <Card key={s.key} className="shadow-card">
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                {s.label}
              </Typography>
              {isLoading ? (
                <Skeleton variant="text" width="60%" height={40} className="mt-1" />
              ) : (
                <Typography variant="h5" className="mt-1">
                  {s.value != null ? s.value.toLocaleString('it-IT') : t('common:generic.notAvailable')}
                </Typography>
              )}
              {isLoading ? (
                <Skeleton variant="text" width="40%" height={20} />
              ) : s.trend ? (
                <Typography
                  variant="caption"
                  color={s.trend.startsWith('-') ? 'error.main' : 'success.main'}
                >
                  {s.trend}
                </Typography>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </Stack>
  );
}

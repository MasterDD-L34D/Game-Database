
import { Alert, Button, Card, CardContent, Chip, Grid, Skeleton, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useDashboardStats } from '../features/dashboard/hooks';
import { Link as RouterLink } from 'react-router-dom';

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

  const taxonomyCards = useMemo(
    () => [
      {
        key: 'traits',
        label: t('dashboard:taxonomy.traits'),
        value: data?.taxonomy.entities.traits ?? null,
        to: '/traits',
      },
      {
        key: 'biomes',
        label: t('dashboard:taxonomy.biomes'),
        value: data?.taxonomy.entities.biomes ?? null,
        to: '/biomes',
      },
      {
        key: 'species',
        label: t('dashboard:taxonomy.species'),
        value: data?.taxonomy.entities.species ?? null,
        to: '/species',
      },
      {
        key: 'ecosystems',
        label: t('dashboard:taxonomy.ecosystems'),
        value: data?.taxonomy.entities.ecosystems ?? null,
        to: '/ecosystems',
      },
      {
        key: 'speciesTraits',
        label: t('dashboard:relations.speciesTraits'),
        value: data?.taxonomy.relations.speciesTraits ?? null,
        to: '/species-traits',
      },
      {
        key: 'speciesBiomes',
        label: t('dashboard:relations.speciesBiomes'),
        value: data?.taxonomy.relations.speciesBiomes ?? null,
        to: '/species-biomes',
      },
      {
        key: 'ecosystemBiomes',
        label: t('dashboard:relations.ecosystemBiomes'),
        value: data?.taxonomy.relations.ecosystemBiomes ?? null,
        to: '/ecosystem-biomes',
      },
      {
        key: 'ecosystemSpecies',
        label: t('dashboard:relations.ecosystemSpecies'),
        value: data?.taxonomy.relations.ecosystemSpecies ?? null,
        to: '/ecosystem-species',
      },
    ],
    [data?.taxonomy.entities.biomes, data?.taxonomy.entities.ecosystems, data?.taxonomy.entities.species, data?.taxonomy.entities.traits, data?.taxonomy.relations.ecosystemBiomes, data?.taxonomy.relations.ecosystemSpecies, data?.taxonomy.relations.speciesBiomes, data?.taxonomy.relations.speciesTraits, t],
  );

  const qualityItems = useMemo(
    () => [
      { label: t('dashboard:quality.orphanTraits'), value: data?.taxonomy.quality.orphanTraits ?? null },
      { label: t('dashboard:quality.orphanBiomes'), value: data?.taxonomy.quality.orphanBiomes ?? null },
      { label: t('dashboard:quality.orphanSpecies'), value: data?.taxonomy.quality.orphanSpecies ?? null },
      { label: t('dashboard:quality.orphanEcosystems'), value: data?.taxonomy.quality.orphanEcosystems ?? null },
    ],
    [data?.taxonomy.quality.orphanBiomes, data?.taxonomy.quality.orphanEcosystems, data?.taxonomy.quality.orphanSpecies, data?.taxonomy.quality.orphanTraits, t],
  );

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

      <Card
        sx={(theme) => ({
          boxShadow: theme.customShadows.card,
          background: `linear-gradient(145deg, ${alpha(theme.palette.primary.main, 0.12)}, ${theme.palette.background.paper})`,
        })}
      >
        <CardContent sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2, alignItems: { md: 'center' } }}>
          <Stack spacing={0.75} sx={{ flex: 1 }}>
            <Typography variant="overline" color="text.secondary">
              {t('dashboard:headings.overview')}
            </Typography>
            <Typography variant="h5">{t('dashboard:headings.title')}</Typography>
            <Typography variant="body2" color="text.secondary">
              {t('dashboard:headings.subtitle')}
            </Typography>
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button component={RouterLink} to="/records" variant="outlined">
              {t('dashboard:actions.records')}
            </Button>
            <Button component={RouterLink} to="/species-traits" variant="contained">
              {t('dashboard:actions.relations')}
            </Button>
          </Stack>
        </CardContent>
      </Card>

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

      <Grid container spacing={2}>
        {taxonomyCards.map((card) => (
          <Grid item xs={12} sm={6} lg={3} key={card.key}>
            <Card sx={{ height: '100%' }}>
              <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                <Typography variant="body2" color="text.secondary">
                  {card.label}
                </Typography>
                {isLoading ? (
                  <Skeleton variant="text" width="50%" height={34} />
                ) : (
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    {card.value != null ? card.value.toLocaleString('it-IT') : t('common:generic.notAvailable')}
                  </Typography>
                )}
                <Button component={RouterLink} to={card.to} size="small" variant="text">
                  {t('dashboard:actions.openModule')}
                </Button>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Card>
        <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="h6">{t('dashboard:quality.title')}</Typography>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            {qualityItems.map((item) => (
              <Chip
                key={item.label}
                label={`${item.label}: ${item.value != null ? item.value.toLocaleString('it-IT') : t('common:generic.notAvailable')}`}
                color={item.value && item.value > 0 ? 'warning' : 'success'}
                variant={item.value && item.value > 0 ? 'filled' : 'outlined'}
              />
            ))}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}

import { useMemo } from 'react';
import {
  Alert,
  Breadcrumbs,
  Link as MuiLink,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getBiome, listAllEcosystems, listAllSpecies } from '../../../lib/taxonomy';
import { getEcosystemBiomes, getSpeciesBiomes } from '../../../lib/taxonomyRelations';

export default function BiomeDetailsPage() {
  const { biomeId = '' } = useParams<{ biomeId: string }>();
  const { t } = useTranslation(['taxonomy', 'common', 'navigation']);

  const biomeQuery = useQuery({
    queryKey: ['biome', 'detail', biomeId],
    queryFn: () => getBiome(biomeId),
    enabled: Boolean(biomeId),
  });

  const speciesQuery = useQuery({
    queryKey: ['species', 'all'],
    queryFn: () => listAllSpecies(''),
  });

  const ecosystemsQuery = useQuery({
    queryKey: ['ecosystems', 'all'],
    queryFn: () => listAllEcosystems(''),
  });

  const speciesRelationsQuery = useQuery({
    queryKey: ['species-biomes', 'by-biome', biomeId],
    queryFn: () => getSpeciesBiomes({ biomeId }),
    enabled: Boolean(biomeId),
  });

  const ecosystemRelationsQuery = useQuery({
    queryKey: ['ecosystem-biomes', 'by-biome', biomeId],
    queryFn: () => getEcosystemBiomes({ biomeId }),
    enabled: Boolean(biomeId),
  });

  const speciesById = useMemo(
    () => Object.fromEntries((speciesQuery.data ?? []).map((item) => [item.id, item])),
    [speciesQuery.data],
  );
  const ecosystemsById = useMemo(
    () => Object.fromEntries((ecosystemsQuery.data ?? []).map((item) => [item.id, item])),
    [ecosystemsQuery.data],
  );

  const biome = biomeQuery.data;
  const speciesRelations = speciesRelationsQuery.data ?? [];
  const ecosystemRelations = ecosystemRelationsQuery.data ?? [];
  const isLoading =
    biomeQuery.isLoading ||
    speciesQuery.isLoading ||
    ecosystemsQuery.isLoading ||
    speciesRelationsQuery.isLoading ||
    ecosystemRelationsQuery.isLoading;

  return (
    <Stack spacing={3}>
      <Breadcrumbs>
        <MuiLink component={RouterLink} to="/" color="inherit">
          {t('navigation:dashboard')}
        </MuiLink>
        <MuiLink component={RouterLink} to="/biomes" color="inherit">
          {t('taxonomy:biomes.title')}
        </MuiLink>
        <Typography color="text.primary">{biome?.name ?? biomeId}</Typography>
      </Breadcrumbs>

      {biomeQuery.isError ? <Alert severity="error">{t('common:feedback.loadError')}</Alert> : null}
      {isLoading ? <Typography color="text.secondary">{t('common:status.loading')}</Typography> : null}

      {biome ? (
        <Paper sx={{ p: 3 }}>
          <Stack spacing={1}>
            <Typography variant="h5">{biome.name}</Typography>
            <Typography variant="body2" color="text.secondary">
              {biome.slug}
            </Typography>
            <Typography variant="body2">
              {t('taxonomy:biomes.columns.climate')}: {biome.climate || t('common:generic.notAvailable')}
            </Typography>
            <Typography variant="body2">
              {t('taxonomy:biomes.columns.description')}: {biome.description || t('common:generic.notAvailable')}
            </Typography>
          </Stack>
        </Paper>
      ) : null}

      <Paper sx={{ p: 3 }}>
        <Stack spacing={1}>
          <Typography variant="h6">{t('taxonomy:species.title')}</Typography>
          {speciesRelations.length === 0 ? (
            <Typography color="text.secondary">{t('taxonomy:detail.empty')}</Typography>
          ) : (
            speciesRelations.map((relation) => {
              const species = speciesById[relation.speciesId];
              return (
                <Stack key={relation.id} direction="row" spacing={1} alignItems="center">
                  <MuiLink component={RouterLink} to={`/species/${relation.speciesId}`}>
                    {species?.scientificName ?? relation.speciesId}
                  </MuiLink>
                  <Typography color="text.secondary">•</Typography>
                  <Typography color="text.secondary">{relation.presence}</Typography>
                </Stack>
              );
            })
          )}
        </Stack>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Stack spacing={1}>
          <Typography variant="h6">{t('taxonomy:ecosystems.title')}</Typography>
          {ecosystemRelations.length === 0 ? (
            <Typography color="text.secondary">{t('taxonomy:detail.empty')}</Typography>
          ) : (
            ecosystemRelations.map((relation) => {
              const ecosystem = ecosystemsById[relation.ecosystemId];
              return (
                <Stack key={relation.id} direction="row" spacing={1} alignItems="center">
                  <MuiLink component={RouterLink} to={`/ecosystems/${relation.ecosystemId}`}>
                    {ecosystem?.name ?? relation.ecosystemId}
                  </MuiLink>
                  <Typography color="text.secondary">•</Typography>
                  <Typography color="text.secondary">
                    {relation.proportion ?? t('common:generic.notAvailable')}
                  </Typography>
                </Stack>
              );
            })
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}

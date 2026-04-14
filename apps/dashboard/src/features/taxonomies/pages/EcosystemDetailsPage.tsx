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
import { getEcosystem, listAllBiomes, listAllSpecies } from '../../../lib/taxonomy';
import { getEcosystemBiomes, getEcosystemSpecies } from '../../../lib/taxonomyRelations';

export default function EcosystemDetailsPage() {
  const { ecosystemId = '' } = useParams<{ ecosystemId: string }>();
  const { t } = useTranslation(['taxonomy', 'common', 'navigation']);

  const ecosystemQuery = useQuery({
    queryKey: ['ecosystem', 'detail', ecosystemId],
    queryFn: () => getEcosystem(ecosystemId),
    enabled: Boolean(ecosystemId),
  });

  const biomesQuery = useQuery({
    queryKey: ['biomes', 'all'],
    queryFn: () => listAllBiomes(''),
  });
  const speciesQuery = useQuery({
    queryKey: ['species', 'all'],
    queryFn: () => listAllSpecies(''),
  });

  const ecosystemBiomesQuery = useQuery({
    queryKey: ['ecosystem-biomes', 'by-ecosystem', ecosystemId],
    queryFn: () => getEcosystemBiomes({ ecosystemId }),
    enabled: Boolean(ecosystemId),
  });
  const ecosystemSpeciesQuery = useQuery({
    queryKey: ['ecosystem-species', 'by-ecosystem', ecosystemId],
    queryFn: () => getEcosystemSpecies({ ecosystemId }),
    enabled: Boolean(ecosystemId),
  });

  const biomesById = useMemo(
    () => Object.fromEntries((biomesQuery.data ?? []).map((item) => [item.id, item])),
    [biomesQuery.data],
  );
  const speciesById = useMemo(
    () => Object.fromEntries((speciesQuery.data ?? []).map((item) => [item.id, item])),
    [speciesQuery.data],
  );

  const ecosystem = ecosystemQuery.data;
  const biomeRelations = ecosystemBiomesQuery.data ?? [];
  const speciesRelations = ecosystemSpeciesQuery.data ?? [];
  const isLoading =
    ecosystemQuery.isLoading ||
    biomesQuery.isLoading ||
    speciesQuery.isLoading ||
    ecosystemBiomesQuery.isLoading ||
    ecosystemSpeciesQuery.isLoading;

  return (
    <Stack spacing={3}>
      <Breadcrumbs>
        <MuiLink component={RouterLink} to="/" color="inherit">
          {t('navigation:dashboard')}
        </MuiLink>
        <MuiLink component={RouterLink} to="/ecosystems" color="inherit">
          {t('taxonomy:ecosystems.title')}
        </MuiLink>
        <Typography color="text.primary">{ecosystem?.name ?? ecosystemId}</Typography>
      </Breadcrumbs>

      {ecosystemQuery.isError ? <Alert severity="error">{t('common:feedback.loadError')}</Alert> : null}
      {isLoading ? <Typography color="text.secondary">{t('common:status.loading')}</Typography> : null}

      {ecosystem ? (
        <Paper sx={{ p: 3 }}>
          <Stack spacing={1}>
            <Typography variant="h5">{ecosystem.name}</Typography>
            <Typography variant="body2" color="text.secondary">
              {ecosystem.slug}
            </Typography>
            <Typography variant="body2">
              {t('taxonomy:ecosystems.columns.region')}: {ecosystem.region || t('common:generic.notAvailable')}
            </Typography>
            <Typography variant="body2">
              {t('taxonomy:ecosystems.columns.climate')}: {ecosystem.climate || t('common:generic.notAvailable')}
            </Typography>
            <Typography variant="body2">
              {t('taxonomy:ecosystems.columns.description')}: {ecosystem.description || t('common:generic.notAvailable')}
            </Typography>
          </Stack>
        </Paper>
      ) : null}

      <Paper sx={{ p: 3 }}>
        <Stack spacing={1}>
          <Typography variant="h6">{t('taxonomy:biomes.title')}</Typography>
          {biomeRelations.length === 0 ? (
            <Typography color="text.secondary">{t('taxonomy:detail.empty')}</Typography>
          ) : (
            biomeRelations.map((relation) => {
              const biome = biomesById[relation.biomeId];
              return (
                <Stack key={relation.id} direction="row" spacing={1} alignItems="center">
                  <MuiLink component={RouterLink} to={`/biomes/${relation.biomeId}`}>
                    {biome?.name ?? relation.biomeId}
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
                  <Typography color="text.secondary">{relation.role}</Typography>
                </Stack>
              );
            })
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}

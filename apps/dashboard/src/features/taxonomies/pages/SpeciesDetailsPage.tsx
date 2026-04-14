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
import { getSpecies, listAllBiomes, listAllEcosystems, listAllTraits } from '../../../lib/taxonomy';
import { getEcosystemSpecies, getSpeciesBiomes, getSpeciesTraits } from '../../../lib/taxonomyRelations';

function relationValue(entry: { bool?: boolean | null; num?: number | null; text?: string | null; value?: unknown; unit?: string | null }) {
  if (entry.bool !== null && entry.bool !== undefined) return entry.bool ? 'true' : 'false';
  if (entry.num !== null && entry.num !== undefined) return `${entry.num}${entry.unit ? ` ${entry.unit}` : ''}`;
  if (entry.text) return entry.text;
  if (typeof entry.value === 'string') return entry.value;
  return '—';
}

export default function SpeciesDetailsPage() {
  const { speciesId = '' } = useParams<{ speciesId: string }>();
  const { t } = useTranslation(['taxonomy', 'common', 'navigation']);

  const speciesQuery = useQuery({
    queryKey: ['species', 'detail', speciesId],
    queryFn: () => getSpecies(speciesId),
    enabled: Boolean(speciesId),
  });

  const traitsQuery = useQuery({
    queryKey: ['traits', 'all'],
    queryFn: () => listAllTraits(''),
  });
  const biomesQuery = useQuery({
    queryKey: ['biomes', 'all'],
    queryFn: () => listAllBiomes(''),
  });
  const ecosystemsQuery = useQuery({
    queryKey: ['ecosystems', 'all'],
    queryFn: () => listAllEcosystems(''),
  });

  const speciesTraitsQuery = useQuery({
    queryKey: ['species-traits', 'by-species', speciesId],
    queryFn: () => getSpeciesTraits({ speciesId }),
    enabled: Boolean(speciesId),
  });
  const speciesBiomesQuery = useQuery({
    queryKey: ['species-biomes', 'by-species', speciesId],
    queryFn: () => getSpeciesBiomes({ speciesId }),
    enabled: Boolean(speciesId),
  });
  const ecosystemSpeciesQuery = useQuery({
    queryKey: ['ecosystem-species', 'by-species', speciesId],
    queryFn: () => getEcosystemSpecies({ speciesId }),
    enabled: Boolean(speciesId),
  });

  const traitsById = useMemo(
    () => Object.fromEntries((traitsQuery.data ?? []).map((item) => [item.id, item])),
    [traitsQuery.data],
  );
  const biomesById = useMemo(
    () => Object.fromEntries((biomesQuery.data ?? []).map((item) => [item.id, item])),
    [biomesQuery.data],
  );
  const ecosystemsById = useMemo(
    () => Object.fromEntries((ecosystemsQuery.data ?? []).map((item) => [item.id, item])),
    [ecosystemsQuery.data],
  );

  const species = speciesQuery.data;
  const traitRelations = speciesTraitsQuery.data ?? [];
  const biomeRelations = speciesBiomesQuery.data ?? [];
  const ecosystemRelations = ecosystemSpeciesQuery.data ?? [];
  const isLoading =
    speciesQuery.isLoading ||
    traitsQuery.isLoading ||
    biomesQuery.isLoading ||
    ecosystemsQuery.isLoading ||
    speciesTraitsQuery.isLoading ||
    speciesBiomesQuery.isLoading ||
    ecosystemSpeciesQuery.isLoading;

  return (
    <Stack spacing={3}>
      <Breadcrumbs>
        <MuiLink component={RouterLink} to="/" color="inherit">
          {t('navigation:dashboard')}
        </MuiLink>
        <MuiLink component={RouterLink} to="/species" color="inherit">
          {t('taxonomy:species.title')}
        </MuiLink>
        <Typography color="text.primary">{species?.scientificName ?? speciesId}</Typography>
      </Breadcrumbs>

      {speciesQuery.isError ? <Alert severity="error">{t('common:feedback.loadError')}</Alert> : null}
      {isLoading ? <Typography color="text.secondary">{t('common:status.loading')}</Typography> : null}

      {species ? (
        <Paper sx={{ p: 3 }}>
          <Stack spacing={1}>
            <Typography variant="h5">{species.scientificName}</Typography>
            <Typography variant="body2" color="text.secondary">
              {species.slug}
            </Typography>
            <Typography variant="body2">
              {t('taxonomy:species.columns.commonName')}: {species.commonName || t('common:generic.notAvailable')}
            </Typography>
            <Typography variant="body2">
              {t('taxonomy:species.columns.family')}: {species.family || t('common:generic.notAvailable')}
            </Typography>
            <Typography variant="body2">
              {t('taxonomy:species.columns.status')}: {species.status || t('common:generic.notAvailable')}
            </Typography>
            <Typography variant="body2">
              {t('taxonomy:species.form.description')}: {species.description || t('common:generic.notAvailable')}
            </Typography>
          </Stack>
        </Paper>
      ) : null}

      <Paper sx={{ p: 3 }}>
        <Stack spacing={1}>
          <Typography variant="h6">{t('taxonomy:traits.title')}</Typography>
          {traitRelations.length === 0 ? (
            <Typography color="text.secondary">{t('taxonomy:detail.empty')}</Typography>
          ) : (
            traitRelations.map((relation) => {
              const trait = traitsById[relation.traitId];
              return (
                <Stack key={relation.id} direction="row" spacing={1} alignItems="center">
                  <MuiLink component={RouterLink} to={`/traits/${relation.traitId}`}>
                    {trait?.name ?? relation.traitId}
                  </MuiLink>
                  <Typography color="text.secondary">•</Typography>
                  <Typography color="text.secondary">{relationValue(relation)}</Typography>
                </Stack>
              );
            })
          )}
        </Stack>
      </Paper>

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

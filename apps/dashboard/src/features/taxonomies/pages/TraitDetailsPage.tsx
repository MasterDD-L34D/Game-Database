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
import { getTrait, listAllSpecies } from '../../../lib/taxonomy';
import { getSpeciesTraits } from '../../../lib/taxonomyRelations';

function renderRelationValue(entry: { bool?: boolean | null; num?: number | null; text?: string | null; value?: unknown; unit?: string | null }) {
  if (entry.bool !== null && entry.bool !== undefined) return entry.bool ? 'true' : 'false';
  if (entry.num !== null && entry.num !== undefined) return `${entry.num}${entry.unit ? ` ${entry.unit}` : ''}`;
  if (entry.text) return entry.text;
  if (typeof entry.value === 'string') return entry.value;
  return '—';
}

export default function TraitDetailsPage() {
  const { traitId = '' } = useParams<{ traitId: string }>();
  const { t } = useTranslation(['taxonomy', 'common', 'navigation']);

  const traitQuery = useQuery({
    queryKey: ['trait', 'detail', traitId],
    queryFn: () => getTrait(traitId),
    enabled: Boolean(traitId),
  });

  const speciesQuery = useQuery({
    queryKey: ['species', 'all'],
    queryFn: () => listAllSpecies(''),
  });

  const relationsQuery = useQuery({
    queryKey: ['species-traits', 'by-trait', traitId],
    queryFn: () => getSpeciesTraits({ traitId }),
    enabled: Boolean(traitId),
  });

  const speciesById = useMemo(
    () => Object.fromEntries((speciesQuery.data ?? []).map((item) => [item.id, item])),
    [speciesQuery.data],
  );

  const trait = traitQuery.data;
  const relations = relationsQuery.data ?? [];
  const isLoading = traitQuery.isLoading || speciesQuery.isLoading || relationsQuery.isLoading;

  return (
    <Stack spacing={3}>
      <Breadcrumbs>
        <MuiLink component={RouterLink} to="/" color="inherit">
          {t('navigation:dashboard')}
        </MuiLink>
        <MuiLink component={RouterLink} to="/traits" color="inherit">
          {t('taxonomy:traits.title')}
        </MuiLink>
        <Typography color="text.primary">{trait?.name ?? traitId}</Typography>
      </Breadcrumbs>

      {traitQuery.isError ? (
        <Alert severity="error">{t('common:feedback.loadError')}</Alert>
      ) : null}

      {isLoading ? (
        <Typography color="text.secondary">{t('common:status.loading')}</Typography>
      ) : null}

      {trait ? (
        <Paper sx={{ p: 3 }}>
          <Stack spacing={1}>
            <Typography variant="h5">{trait.name}</Typography>
            <Typography variant="body2" color="text.secondary">
              {trait.slug}
            </Typography>
            <Typography variant="body2">
              {t('taxonomy:traits.columns.dataType')}: {trait.dataType}
            </Typography>
            <Typography variant="body2">
              {t('taxonomy:traits.columns.category')}: {trait.category || t('common:generic.notAvailable')}
            </Typography>
            <Typography variant="body2">
              {t('taxonomy:traits.columns.unit')}: {trait.unit || t('common:generic.notAvailable')}
            </Typography>
            <Typography variant="body2">
              {t('taxonomy:traits.form.description')}: {trait.description || t('common:generic.notAvailable')}
            </Typography>
          </Stack>
        </Paper>
      ) : null}

      <Paper sx={{ p: 3 }}>
        <Stack spacing={1}>
          <Typography variant="h6">{t('taxonomy:species.title')}</Typography>
          {relations.length === 0 ? (
            <Typography color="text.secondary">{t('taxonomy:detail.empty')}</Typography>
          ) : (
            relations.map((relation) => {
              const species = speciesById[relation.speciesId];
              return (
                <Stack key={relation.id} direction="row" spacing={1} alignItems="center">
                  <MuiLink component={RouterLink} to={`/species/${relation.speciesId}`}>
                    {species?.scientificName ?? relation.speciesId}
                  </MuiLink>
                  <Typography color="text.secondary">•</Typography>
                  <Typography color="text.secondary">{renderRelationValue(relation)}</Typography>
                </Stack>
              );
            })
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}

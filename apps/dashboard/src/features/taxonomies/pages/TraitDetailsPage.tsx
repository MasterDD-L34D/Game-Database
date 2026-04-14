import { useMemo } from 'react';
import { Alert, Breadcrumbs, Link as MuiLink, Stack, Typography } from '@mui/material';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getTrait, listAllSpecies } from '../../../lib/taxonomy';
import { getSpeciesTraits } from '../../../lib/taxonomyRelations';
import { EntityDetailCard, RelationListCard } from '../components/EntityDetailCard';

function renderRelationValue(entry: { bool?: boolean | null; num?: number | null; text?: string | null; value?: unknown; unit?: string | null }) {
  if (entry.bool !== null && entry.bool !== undefined) return entry.bool ? 'true' : 'false';
  if (entry.num !== null && entry.num !== undefined) return `${entry.num}${entry.unit ? ` ${entry.unit}` : ''}`;
  if (entry.text) return entry.text;
  if (typeof entry.value === 'string') return entry.value;
  return '-';
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

      {traitQuery.isError ? <Alert severity="error">{t('common:feedback.loadError')}</Alert> : null}
      {isLoading ? <Typography color="text.secondary">{t('common:status.loading')}</Typography> : null}

      {trait ? (
        <EntityDetailCard
          title={trait.name}
          subtitle={trait.slug}
          summary={[
            { label: t('taxonomy:traits.columns.dataType'), value: trait.dataType },
            { label: t('taxonomy:traits.columns.category'), value: trait.category || t('common:generic.notAvailable') },
            { label: t('taxonomy:traits.columns.unit'), value: trait.unit || t('common:generic.notAvailable') },
            { label: t('taxonomy:traits.form.description'), value: trait.description || t('common:generic.notAvailable') },
          ]}
        />
      ) : null}

      <RelationListCard title={t('taxonomy:species.title')} emptyLabel={t('taxonomy:detail.empty')}>
        {relations.map((relation) => {
          const species = speciesById[relation.speciesId];
          return (
            <Stack key={relation.id} direction="row" spacing={1} alignItems="center">
              <MuiLink component={RouterLink} to={`/species/${relation.speciesId}`}>
                {species?.scientificName ?? relation.speciesId}
              </MuiLink>
              <Typography color="text.secondary">-</Typography>
              <Typography color="text.secondary">{renderRelationValue(relation)}</Typography>
            </Stack>
          );
        })}
      </RelationListCard>
    </Stack>
  );
}

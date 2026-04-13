import { useMemo } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Link, List, ListItem, Paper, Stack, Typography } from '@mui/material';
import TaxonomyDetailScaffold from '../components/TaxonomyDetailScaffold';
import { getTrait } from '../../../lib/taxonomy';

function formatValue(value?: string | null) {
  return value && value.trim() ? value : '—';
}

export default function TraitDetailPage() {
  const { traitId = '' } = useParams<{ traitId: string }>();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['traits', 'detail', traitId],
    queryFn: () => getTrait(traitId),
    enabled: Boolean(traitId),
  });

  const metaItems = useMemo(
    () =>
      data
        ? [
            { label: 'Slug', value: data.slug },
            { label: 'Categoria', value: formatValue(data.category) },
            { label: 'Tipo dato', value: data.dataType },
            { label: 'Unita', value: formatValue(data.unit) },
            { label: 'Descrizione', value: formatValue(data.description) },
            {
              label: 'Valori consentiti',
              value: data.allowedValues?.length ? data.allowedValues.join(', ') : '—',
            },
          ]
        : [],
    [data],
  );

  return (
    <TaxonomyDetailScaffold
      breadcrumbs={[
        { label: 'Dashboard', to: '/' },
        { label: 'Trait', to: '/traits' },
        { label: data?.name ?? traitId },
      ]}
      title={data?.name ?? 'Dettaglio trait'}
      subtitle={data?.category ?? null}
      loading={isLoading}
      error={isError ? error instanceof Error ? error.message : 'Impossibile caricare il trait.' : null}
      onRetry={() => refetch()}
      backTo="/traits"
      metaItems={metaItems}
    >
      {data ? (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="h6">Specie collegate</Typography>
          {data.speciesValues.length ? (
            <List dense>
              {data.speciesValues.map((entry) => (
                <ListItem key={entry.id} disableGutters>
                  <Link component={RouterLink} to={`/species/${entry.species?.slug ?? entry.speciesId}`} underline="hover">
                    {entry.species?.scientificName ?? entry.speciesId}
                  </Link>
                  <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                    {entry.category ? `(${entry.category})` : ''}
                  </Typography>
                </ListItem>
              ))}
            </List>
          ) : (
            <Typography color="text.secondary">Nessuna specie collegata.</Typography>
          )}
        </Paper>
      ) : null}
    </TaxonomyDetailScaffold>
  );
}

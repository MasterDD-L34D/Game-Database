import { useMemo } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Link, List, ListItem, Paper, Stack, Typography } from '@mui/material';
import TaxonomyDetailScaffold from '../components/TaxonomyDetailScaffold';
import { getBiome } from '../../../lib/taxonomy';

function formatValue(value?: string | null) {
  return value && value.trim() ? value : '—';
}

export default function BiomeDetailPage() {
  const { biomeId = '' } = useParams<{ biomeId: string }>();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['biomes', 'detail', biomeId],
    queryFn: () => getBiome(biomeId),
    enabled: Boolean(biomeId),
  });

  const metaItems = useMemo(
    () =>
      data
        ? [
            { label: 'Slug', value: data.slug },
            { label: 'Clima', value: formatValue(data.climate) },
            {
              label: 'Bioma padre',
              value: data.parent ? (
                <Link component={RouterLink} to={`/biomes/${data.parent.slug}`} underline="hover">
                  {data.parent.name}
                </Link>
              ) : (
                '—'
              ),
            },
            { label: 'Descrizione', value: formatValue(data.description) },
          ]
        : [],
    [data],
  );

  return (
    <TaxonomyDetailScaffold
      breadcrumbs={[
        { label: 'Dashboard', to: '/' },
        { label: 'Biomi', to: '/biomes' },
        { label: data?.name ?? biomeId },
      ]}
      title={data?.name ?? 'Dettaglio bioma'}
      subtitle={data?.climate ?? null}
      loading={isLoading}
      error={isError ? error instanceof Error ? error.message : 'Impossibile caricare il bioma.' : null}
      onRetry={() => refetch()}
      backTo="/biomes"
      metaItems={metaItems}
    >
      {data ? (
        <Stack spacing={2}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="h6">Specie collegate</Typography>
            {data.species.length ? (
              <List dense>
                {data.species.map((entry) => (
                  <ListItem key={entry.id} disableGutters>
                    <Link component={RouterLink} to={`/species/${entry.species?.slug ?? entry.speciesId}`} underline="hover">
                      {entry.species?.scientificName ?? entry.speciesId}
                    </Link>
                    <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                      {entry.presence}
                    </Typography>
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography color="text.secondary">Nessuna specie collegata.</Typography>
            )}
          </Paper>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="h6">Ecosistemi collegati</Typography>
            {data.ecosystems.length ? (
              <List dense>
                {data.ecosystems.map((entry) => (
                  <ListItem key={entry.id} disableGutters>
                    <Link component={RouterLink} to={`/ecosystems/${entry.ecosystem?.slug ?? entry.ecosystemId}`} underline="hover">
                      {entry.ecosystem?.name ?? entry.ecosystemId}
                    </Link>
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography color="text.secondary">Nessun ecosistema collegato.</Typography>
            )}
          </Paper>
        </Stack>
      ) : null}
    </TaxonomyDetailScaffold>
  );
}

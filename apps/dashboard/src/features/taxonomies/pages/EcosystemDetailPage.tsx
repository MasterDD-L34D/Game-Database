import { useMemo } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Link, List, ListItem, Paper, Stack, Typography } from '@mui/material';
import TaxonomyDetailScaffold from '../components/TaxonomyDetailScaffold';
import { getEcosystem } from '../../../lib/taxonomy';

function formatValue(value?: string | null) {
  return value && value.trim() ? value : '—';
}

export default function EcosystemDetailPage() {
  const { ecosystemId = '' } = useParams<{ ecosystemId: string }>();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['ecosystems', 'detail', ecosystemId],
    queryFn: () => getEcosystem(ecosystemId),
    enabled: Boolean(ecosystemId),
  });

  const metaItems = useMemo(
    () =>
      data
        ? [
            { label: 'Slug', value: data.slug },
            { label: 'Regione', value: formatValue(data.region) },
            { label: 'Clima', value: formatValue(data.climate) },
            { label: 'Descrizione', value: formatValue(data.description) },
          ]
        : [],
    [data],
  );

  return (
    <TaxonomyDetailScaffold
      breadcrumbs={[
        { label: 'Dashboard', to: '/' },
        { label: 'Ecosistemi', to: '/ecosystems' },
        { label: data?.name ?? ecosystemId },
      ]}
      title={data?.name ?? 'Dettaglio ecosistema'}
      subtitle={data?.region ?? null}
      loading={isLoading}
      error={isError ? error instanceof Error ? error.message : 'Impossibile caricare l ecosistema.' : null}
      onRetry={() => refetch()}
      backTo="/ecosystems"
      metaItems={metaItems}
    >
      {data ? (
        <Stack spacing={2}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="h6">Biomi collegati</Typography>
            {data.biomes.length ? (
              <List dense>
                {data.biomes.map((entry) => (
                  <ListItem key={entry.id} disableGutters>
                    <Link component={RouterLink} to={`/biomes/${entry.biome?.slug ?? entry.biomeId}`} underline="hover">
                      {entry.biome?.name ?? entry.biomeId}
                    </Link>
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography color="text.secondary">Nessun bioma collegato.</Typography>
            )}
          </Paper>
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
                      {entry.role}
                    </Typography>
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography color="text.secondary">Nessuna specie collegata.</Typography>
            )}
          </Paper>
        </Stack>
      ) : null}
    </TaxonomyDetailScaffold>
  );
}

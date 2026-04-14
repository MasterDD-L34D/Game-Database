import { useMemo } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Divider, Link, List, ListItem, Paper, Stack, Typography } from '@mui/material';
import TaxonomyDetailScaffold from '../components/TaxonomyDetailScaffold';
import { getSpecies } from '../../../lib/taxonomy';

function formatValue(value?: string | null) {
  return value && value.trim() ? value : '—';
}

export default function SpeciesDetailPage() {
  const { speciesId = '' } = useParams<{ speciesId: string }>();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['species', 'detail', speciesId],
    queryFn: () => getSpecies(speciesId),
    enabled: Boolean(speciesId),
  });

  const metaItems = useMemo(
    () =>
      data
        ? [
            { label: 'Slug', value: data.slug },
            { label: 'Nome comune', value: formatValue(data.commonName) },
            { label: 'Stato', value: formatValue(data.status) },
            { label: 'Famiglia', value: formatValue(data.family) },
            { label: 'Genere', value: formatValue(data.genus) },
            { label: 'Descrizione', value: formatValue(data.description) },
          ]
        : [],
    [data],
  );

  return (
    <TaxonomyDetailScaffold
      breadcrumbs={[
        { label: 'Dashboard', to: '/' },
        { label: 'Specie', to: '/species' },
        { label: data?.scientificName ?? speciesId },
      ]}
      title={data?.scientificName ?? 'Dettaglio specie'}
      subtitle={data?.commonName ?? null}
      loading={isLoading}
      error={isError ? error instanceof Error ? error.message : 'Impossibile caricare la specie.' : null}
      onRetry={() => refetch()}
      backTo="/species"
      metaItems={metaItems}
    >
      {data ? (
        <Stack spacing={2}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="h6">Trait collegati</Typography>
            {data.traits.length ? (
              <List dense>
                {data.traits.map((entry) => (
                  <ListItem key={entry.id} disableGutters>
                    <Link component={RouterLink} to={`/traits/${entry.trait?.slug ?? entry.traitId}`} underline="hover">
                      {entry.trait?.name ?? entry.traitId}
                    </Link>
                    <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                      {entry.category ? `(${entry.category})` : ''}
                      {entry.text ?? (entry.num != null ? ` ${entry.num}` : '')}
                    </Typography>
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography color="text.secondary">Nessun trait collegato.</Typography>
            )}
          </Paper>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="h6">Biomi collegati</Typography>
            {data.biomes.length ? (
              <List dense>
                {data.biomes.map((entry) => (
                  <ListItem key={entry.id} disableGutters>
                    <Link component={RouterLink} to={`/biomes/${entry.biome?.slug ?? entry.biomeId}`} underline="hover">
                      {entry.biome?.name ?? entry.biomeId}
                    </Link>
                    <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                      {entry.presence}
                    </Typography>
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography color="text.secondary">Nessun bioma collegato.</Typography>
            )}
          </Paper>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="h6">Ecosistemi collegati</Typography>
            {data.ecosystems.length ? (
              <List dense>
                {data.ecosystems.map((entry, index) => (
                  <div key={entry.id}>
                    <ListItem disableGutters>
                      <Link component={RouterLink} to={`/ecosystems/${entry.ecosystem?.slug ?? entry.ecosystemId}`} underline="hover">
                        {entry.ecosystem?.name ?? entry.ecosystemId}
                      </Link>
                      <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                        {entry.role}
                      </Typography>
                    </ListItem>
                    {index < data.ecosystems.length - 1 ? <Divider /> : null}
                  </div>
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

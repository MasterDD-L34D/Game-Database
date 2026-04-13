import { ReactNode } from 'react';
import {
  Alert,
  Breadcrumbs,
  Button,
  Grid,
  LinearProgress,
  Link as MuiLink,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

type Crumb = {
  label: string;
  to?: string;
};

type MetaItem = {
  label: string;
  value: ReactNode;
};

type Props = {
  breadcrumbs: Crumb[];
  title: string;
  subtitle?: string | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  backTo: string;
  metaItems: MetaItem[];
  children?: ReactNode;
};

export default function TaxonomyDetailScaffold({
  breadcrumbs,
  title,
  subtitle,
  loading = false,
  error,
  onRetry,
  backTo,
  metaItems,
  children,
}: Props) {
  return (
    <Stack spacing={3}>
      <Breadcrumbs aria-label="breadcrumb">
        {breadcrumbs.map((crumb) =>
          crumb.to ? (
            <MuiLink key={`${crumb.to}:${crumb.label}`} component={RouterLink} color="inherit" to={crumb.to}>
              {crumb.label}
            </MuiLink>
          ) : (
            <Typography key={crumb.label} color="text.primary">
              {crumb.label}
            </Typography>
          ),
        )}
      </Breadcrumbs>

      <Paper sx={{ p: 3 }}>
        <Stack spacing={3}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', md: 'center' }}>
            <div className="flex-1">
              <Typography variant="h5" component="h1">
                {title}
              </Typography>
              {subtitle ? (
                <Typography variant="body2" color="text.secondary">
                  {subtitle}
                </Typography>
              ) : null}
            </div>
            <Button component={RouterLink} to={backTo} variant="outlined">
              Torna all'elenco
            </Button>
          </Stack>

          {loading ? <LinearProgress aria-label="Caricamento" /> : null}

          {error ? (
            <Alert
              severity="error"
              action={
                onRetry ? (
                  <Button color="inherit" size="small" onClick={onRetry}>
                    Riprova
                  </Button>
                ) : undefined
              }
            >
              {error}
            </Alert>
          ) : null}

          {!loading && !error ? (
            <>
              <Grid container spacing={2}>
                {metaItems.map((item) => (
                  <Grid item xs={12} md={6} key={item.label}>
                    <Typography variant="subtitle2" color="text.secondary">
                      {item.label}
                    </Typography>
                    <Typography variant="body1">{item.value || '—'}</Typography>
                  </Grid>
                ))}
              </Grid>
              {children}
            </>
          ) : null}
        </Stack>
      </Paper>
    </Stack>
  );
}

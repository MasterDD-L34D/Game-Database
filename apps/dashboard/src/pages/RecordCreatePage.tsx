
import { useState, type FormEvent } from 'react';
import { Alert, Paper, Snackbar, Typography, Box, Button, FormControl, FormLabel, TextField, MenuItem } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { postJSON } from '../lib/api';

export default function RecordCreatePage() {
  const navigate = useNavigate();
  const [ok, setOk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation(['records', 'common']);
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body: Record<string, string | null> = {
      nome: (form.get('nome') as string) || '',
      stato: (form.get('stato') as string) || 'Bozza',
      descrizione: (form.get('descrizione') as string) || '',
      data: (form.get('data') as string) || '',
      stile: (form.get('stile') as string) || null,
      pattern: (form.get('pattern') as string) || null,
      peso: (form.get('peso') as string) || null,
      curvatura: (form.get('curvatura') as string) || null,
    };

    try {
      await postJSON('/records', body);
      setOk(true);
      setTimeout(() => navigate('/records'), 400);
    } catch (err) {
      const message = err instanceof Error ? err.message : t('records:create.errorFallback');
      setError(message);
    }
  }

  return (
    <Paper
      sx={(theme) => ({
        padding: theme.layout.cardPadding,
        boxShadow: theme.customShadows.card,
        backgroundColor: theme.palette.background.paper,
      })}
    >
      <Typography variant="h6" sx={(theme) => ({ mb: theme.spacing(2) })}>
        {t('records:create.title')}
      </Typography>
      <form onSubmit={handleSubmit} noValidate>
        <Box
          sx={(theme) => ({
            display: 'grid',
            gap: theme.spacing(3),
            maxWidth: '48rem',
          })}
        >
          <FormControl fullWidth>
            <FormLabel>{t('records:edit.fields.name.label')}</FormLabel>
            <TextField name="nome" placeholder={t('records:edit.fields.name.placeholder')} required />
          </FormControl>
          <FormControl fullWidth>
            <FormLabel>{t('records:edit.fields.status')}</FormLabel>
            <TextField name="stato" select defaultValue="Bozza">
              <MenuItem value="Attivo">{t('records:common.statuses.attivo')}</MenuItem>
              <MenuItem value="Bozza">{t('records:common.statuses.bozza')}</MenuItem>
              <MenuItem value="Archiviato">{t('records:common.statuses.archiviato')}</MenuItem>
            </TextField>
          </FormControl>
          <FormControl fullWidth>
            <FormLabel>{t('records:edit.fields.description.label')}</FormLabel>
            <TextField
              name="descrizione"
              multiline
              minRows={3}
              placeholder={t('records:edit.fields.description.placeholder')}
            />
          </FormControl>
          <FormControl fullWidth>
            <FormLabel>{t('records:edit.fields.date')}</FormLabel>
            <TextField name="data" type="date" InputLabelProps={{ shrink: true }} />
          </FormControl>
          <Box
            sx={(theme) => ({
              display: 'grid',
              gap: theme.spacing(3),
              gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
            })}
          >
            <FormControl fullWidth>
              <FormLabel>{t('records:edit.fields.style')}</FormLabel>
              <TextField name="stile" placeholder={t('records:create.optionalPlaceholder')} />
            </FormControl>
            <FormControl fullWidth>
              <FormLabel>{t('records:edit.fields.pattern')}</FormLabel>
              <TextField name="pattern" placeholder={t('records:create.optionalPlaceholder')} />
            </FormControl>
            <FormControl fullWidth>
              <FormLabel>{t('records:edit.fields.weight')}</FormLabel>
              <TextField name="peso" placeholder={t('records:create.optionalPlaceholder')} />
            </FormControl>
            <FormControl fullWidth>
              <FormLabel>{t('records:edit.fields.curvature')}</FormLabel>
              <TextField name="curvatura" placeholder={t('records:create.optionalPlaceholder')} />
            </FormControl>
          </Box>
        </Box>
        <Box
          sx={(theme) => ({
            position: 'sticky',
            bottom: 0,
            mt: theme.spacing(4),
            borderTop: `1px solid ${theme.palette.divider}`,
            backgroundColor: alpha(theme.palette.background.paper, 0.95),
            backdropFilter: 'blur(6px)',
          })}
        >
          <Box
            sx={(theme) => ({
              maxWidth: '48rem',
              marginInline: 'auto',
              paddingBlock: theme.spacing(2),
              display: 'flex',
              justifyContent: 'flex-end',
              gap: theme.spacing(2),
            })}
          >
            <Button variant="outlined" onClick={()=>navigate('/records')}>
              {t('common:actions.cancel')}
            </Button>
            <Button type="submit" variant="contained">
              {t('records:create.save')}
            </Button>
          </Box>
        </Box>
      </form>
      <Snackbar
        open={ok}
        autoHideDuration={2200}
        onClose={()=>setOk(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert onClose={()=>setOk(false)} severity="success" variant="filled" sx={{ width: '100%' }}>
          {t('records:create.success')}
        </Alert>
      </Snackbar>
      <Snackbar
        open={!!error}
        autoHideDuration={4000}
        onClose={()=>setError(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert onClose={()=>setError(null)} severity="error" variant="filled" sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>
    </Paper>
  );
}

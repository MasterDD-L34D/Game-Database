
import { useState } from 'react';
import { Alert, Paper, Snackbar, Typography, Box, Button, FormControl, FormLabel, TextField, MenuItem } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { postJSON } from '../lib/api';

export default function RecordCreatePage() {
  const navigate = useNavigate(); const [ok, setOk] = useState(false); const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation(['records', 'common']);
  async function handleSubmit(e: any) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const body: any = {
      nome: form.get('nome') || '',
      stato: form.get('stato') || 'Bozza',
      descrizione: form.get('descrizione') || '',
      data: form.get('data') || '',
      stile: form.get('stile') || null,
      pattern: form.get('pattern') || null,
      peso: form.get('peso') || null,
      curvatura: form.get('curvatura') || null,
    };
    try { await postJSON('/records', body); setOk(true); setTimeout(()=>navigate('/records'), 400); }
    catch (e: any) { setError(e?.message ?? t('records:create.errorFallback')); }
  }
  return (
    <Paper className="p-4">
      <Typography variant="h6" className="mb-2">{t('records:create.title')}</Typography>
      <form onSubmit={handleSubmit} noValidate>
        <Box className="space-y-4 max-w-2xl">
          <FormControl fullWidth><FormLabel>{t('records:edit.fields.name.label')}</FormLabel><TextField name="nome" placeholder={t('records:edit.fields.name.placeholder')} required /></FormControl>
          <FormControl fullWidth><FormLabel>{t('records:edit.fields.status')}</FormLabel>
            <TextField name="stato" select defaultValue="Bozza">
              <MenuItem value="Attivo">{t('records:common.statuses.attivo')}</MenuItem><MenuItem value="Bozza">{t('records:common.statuses.bozza')}</MenuItem><MenuItem value="Archiviato">{t('records:common.statuses.archiviato')}</MenuItem>
            </TextField>
          </FormControl>
          <FormControl fullWidth><FormLabel>{t('records:edit.fields.description.label')}</FormLabel><TextField name="descrizione" multiline minRows={3} placeholder={t('records:edit.fields.description.placeholder')} /></FormControl>
          <FormControl fullWidth><FormLabel>{t('records:edit.fields.date')}</FormLabel><TextField name="data" type="date" InputLabelProps={{ shrink: true }} /></FormControl>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FormControl fullWidth><FormLabel>{t('records:edit.fields.style')}</FormLabel><TextField name="stile" placeholder={t('records:create.optionalPlaceholder')} /></FormControl>
            <FormControl fullWidth><FormLabel>{t('records:edit.fields.pattern')}</FormLabel><TextField name="pattern" placeholder={t('records:create.optionalPlaceholder')} /></FormControl>
            <FormControl fullWidth><FormLabel>{t('records:edit.fields.weight')}</FormLabel><TextField name="peso" placeholder={t('records:create.optionalPlaceholder')} /></FormControl>
            <FormControl fullWidth><FormLabel>{t('records:edit.fields.curvature')}</FormLabel><TextField name="curvatura" placeholder={t('records:create.optionalPlaceholder')} /></FormControl>
          </div>
        </Box>
        <Box sx={{ position: 'sticky', bottom: 0 }} className="bg-white border-t border-gray-200 mt-4">
          <Box className="max-w-2xl mx-auto px-0 py-3 flex justify-end gap-2">
            <Button variant="outlined" onClick={()=>navigate('/records')}>{t('common:actions.cancel')}</Button>
            <Button type="submit" variant="contained">{t('records:create.save')}</Button>
          </Box>
        </Box>
      </form>
      <Snackbar open={ok} autoHideDuration={2200} onClose={()=>setOk(false)} anchorOrigin={{ vertical: 'top', horizontal: 'right' }}>
        <Alert onClose={()=>setOk(false)} severity="success" variant="filled" sx={{ width: '100%' }}>{t('records:create.success')}</Alert>
      </Snackbar>
      <Snackbar open={!!error} autoHideDuration={4000} onClose={()=>setError(null)} anchorOrigin={{ vertical: 'top', horizontal: 'right' }}>
        <Alert onClose={()=>setError(null)} severity="error" variant="filled" sx={{ width: '100%' }}>{error}</Alert>
      </Snackbar>
    </Paper>
  );
}

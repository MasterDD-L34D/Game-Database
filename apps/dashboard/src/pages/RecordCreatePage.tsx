
import { useState } from 'react';
import { Alert, Paper, Snackbar, Typography, Box, Button, FormControl, FormLabel, TextField, MenuItem } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { postJSON } from '../lib/api';

export default function RecordCreatePage() {
  const navigate = useNavigate(); const [ok, setOk] = useState(false); const [error, setError] = useState<string | null>(null);
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
    catch (e: any) { setError(e?.message ?? 'Errore nel salvataggio'); }
  }
  return (
    <Paper className="p-4">
      <Typography variant="h6" className="mb-2">Nuovo record</Typography>
      <form onSubmit={handleSubmit} noValidate>
        <Box className="space-y-4 max-w-2xl">
          <FormControl fullWidth><FormLabel>Nome</FormLabel><TextField name="nome" placeholder="Inserisci il nome" required /></FormControl>
          <FormControl fullWidth><FormLabel>Stato</FormLabel>
            <TextField name="stato" select defaultValue="Bozza">
              <MenuItem value="Attivo">Attivo</MenuItem><MenuItem value="Bozza">Bozza</MenuItem><MenuItem value="Archiviato">Archiviato</MenuItem>
            </TextField>
          </FormControl>
          <FormControl fullWidth><FormLabel>Descrizione</FormLabel><TextField name="descrizione" multiline minRows={3} placeholder="Aggiungi una descrizione" /></FormControl>
          <FormControl fullWidth><FormLabel>Data</FormLabel><TextField name="data" type="date" InputLabelProps={{ shrink: true }} /></FormControl>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FormControl fullWidth><FormLabel>Stile</FormLabel><TextField name="stile" placeholder="(facoltativo)" /></FormControl>
            <FormControl fullWidth><FormLabel>Pattern</FormLabel><TextField name="pattern" placeholder="(facoltativo)" /></FormControl>
            <FormControl fullWidth><FormLabel>Peso</FormLabel><TextField name="peso" placeholder="(facoltativo)" /></FormControl>
            <FormControl fullWidth><FormLabel>Curvatura</FormLabel><TextField name="curvatura" placeholder="(facoltativo)" /></FormControl>
          </div>
        </Box>
        <Box sx={{ position: 'sticky', bottom: 0 }} className="bg-white border-t border-gray-200 mt-4">
          <Box className="max-w-2xl mx-auto px-0 py-3 flex justify-end gap-2">
            <Button variant="outlined" onClick={()=>navigate('/records')}>Annulla</Button>
            <Button type="submit" variant="contained">Salva</Button>
          </Box>
        </Box>
      </form>
      <Snackbar open={ok} autoHideDuration={2200} onClose={()=>setOk(false)} anchorOrigin={{ vertical: 'top', horizontal: 'right' }}>
        <Alert onClose={()=>setOk(false)} severity="success" variant="filled" sx={{ width: '100%' }}>Creato con successo</Alert>
      </Snackbar>
      <Snackbar open={!!error} autoHideDuration={4000} onClose={()=>setError(null)} anchorOrigin={{ vertical: 'top', horizontal: 'right' }}>
        <Alert onClose={()=>setError(null)} severity="error" variant="filled" sx={{ width: '100%' }}>{error}</Alert>
      </Snackbar>
    </Paper>
  );
}


import { Stack, TextField, MenuItem, Button } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { Stile, Pattern, Peso, Curvatura } from '../types/record';
type Filters = { stile?: Stile; pattern?: Pattern; peso?: Peso; curvatura?: Curvatura };
const STILI: Stile[] = ['Monolinea','Tratteggiato','Puntinato','Brush','Calligrafico','Geometrico','Organico','DoppioTratto','Ombreggiato','Tecnico','Neon','Sfumato','Angolare','Spezzato','Contour','Ink'];
const PATTERN: Pattern[] = ['Pieno','Tratteggio','Puntinato','Gradiente','Hachure','Contorno','Spezzato','Inchiostro'];
const PESI: Peso[] = ['Sottile','Medio','Spesso','Variabile'];
const CURVE: Curvatura[] = ['Lineare','Curvo','Organico','Angolare'];
export default function FilterPanel({ value, onChange, onClear }: { value: Filters; onChange: (next: Filters) => void; onClear: () => void; }) {
  const { t } = useTranslation(['filters', 'common']);
  return (
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'center' }}>
      <TextField select size="small" label={t('filters:fields.stile')} value={value.stile ?? ''} onChange={(e) => onChange({ ...value, stile: (e.target.value || undefined) as Stile })} sx={{ minWidth: 160 }}>
        <MenuItem value="">{t('common:generic.any')}</MenuItem>{STILI.map(v => <MenuItem key={v} value={v}>{v}</MenuItem>)}
      </TextField>
      <TextField select size="small" label={t('filters:fields.pattern')} value={value.pattern ?? ''} onChange={(e) => onChange({ ...value, pattern: (e.target.value || undefined) as Pattern })} sx={{ minWidth: 160 }}>
        <MenuItem value="">{t('common:generic.any')}</MenuItem>{PATTERN.map(v => <MenuItem key={v} value={v}>{v}</MenuItem>)}
      </TextField>
      <TextField select size="small" label={t('filters:fields.peso')} value={value.peso ?? ''} onChange={(e) => onChange({ ...value, peso: (e.target.value || undefined) as Peso })} sx={{ minWidth: 160 }}>
        <MenuItem value="">{t('common:generic.any')}</MenuItem>{PESI.map(v => <MenuItem key={v} value={v}>{v}</MenuItem>)}
      </TextField>
      <TextField select size="small" label={t('filters:fields.curvatura')} value={value.curvatura ?? ''} onChange={(e) => onChange({ ...value, curvatura: (e.target.value || undefined) as Curvatura })} sx={{ minWidth: 160 }}>
        <MenuItem value="">{t('common:generic.any')}</MenuItem>{CURVE.map(v => <MenuItem key={v} value={v}>{v}</MenuItem>)}
      </TextField>
      <Button variant="text" onClick={onClear}>{t('filters:actions.clearFilters')}</Button>
    </Stack>
  );
}

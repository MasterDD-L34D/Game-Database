
import { Drawer, Box, Divider, Button, Stack } from '@mui/material';
import { useTranslation } from 'react-i18next';
import FilterPanel from './FilterPanel';
import type { Stile, Pattern, Peso, Curvatura } from '../types/record';
export type Filters = { stile?: Stile; pattern?: Pattern; peso?: Peso; curvatura?: Curvatura };
export default function FilterSidebar({ open, value, onChange, onClear, onClose }: { open: boolean; value: Filters; onChange: (next: Filters) => void; onClear: () => void; onClose: () => void; }) {
  const { t } = useTranslation('filters');
  return (
    <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: 320 } }}>
      <Box role="complementary" aria-label={t('sidebar.ariaLabel')} sx={{ p: 2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
          <strong>{t('sidebar.title')}</strong>
          <Button size="small" onClick={onClear}>{t('actions.clear')}</Button>
        </Stack>
        <Divider />
        <Box sx={{ mt: 2 }}><FilterPanel value={value} onChange={onChange} onClear={onClear} /></Box>
        <Box sx={{ position: 'fixed', right: 16, bottom: 16 }}><Button variant="contained" onClick={onClose}>{t('actions.close')}</Button></Box>
      </Box>
    </Drawer>
  );
}


import SearchBar from '../components/SearchBar';
import { Box, Button, Typography } from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMemo } from 'react';

export default function Topbar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { t } = useTranslation(['common', 'navigation']);

  const action = useMemo(() => {
    if (pathname.startsWith('/records')) {
      return {
        to: '/records/new',
        label: t('common:actions.addRecord'),
        section: t('navigation:records'),
        disabled: pathname === '/records/new',
      };
    }
    if (pathname.startsWith('/traits')) {
      return {
        to: '/traits',
        label: t('common:actions.openTraits'),
        section: t('navigation:traits'),
        disabled: pathname === '/traits',
      };
    }
    if (pathname.startsWith('/biomes')) {
      return {
        to: '/biomes',
        label: t('common:actions.openBiomes'),
        section: t('navigation:biomes'),
        disabled: pathname === '/biomes',
      };
    }
    if (pathname.startsWith('/species')) {
      return {
        to: '/species',
        label: t('common:actions.openSpecies'),
        section: t('navigation:species'),
        disabled: pathname === '/species',
      };
    }
    if (pathname.startsWith('/ecosystems')) {
      return {
        to: '/ecosystems',
        label: t('common:actions.openEcosystems'),
        section: t('navigation:ecosystems'),
        disabled: pathname === '/ecosystems',
      };
    }
    if (pathname.startsWith('/species-traits')) {
      return {
        to: '/species-traits',
        label: t('common:actions.openSpeciesTraits'),
        section: t('navigation:speciesTraits'),
        disabled: pathname === '/species-traits',
      };
    }
    if (pathname.startsWith('/species-biomes')) {
      return {
        to: '/species-biomes',
        label: t('common:actions.openSpeciesBiomes'),
        section: t('navigation:speciesBiomes'),
        disabled: pathname === '/species-biomes',
      };
    }
    if (pathname.startsWith('/ecosystem-biomes')) {
      return {
        to: '/ecosystem-biomes',
        label: t('common:actions.openEcosystemBiomes'),
        section: t('navigation:ecosystemBiomes'),
        disabled: pathname === '/ecosystem-biomes',
      };
    }
    if (pathname.startsWith('/ecosystem-species')) {
      return {
        to: '/ecosystem-species',
        label: t('common:actions.openEcosystemSpecies'),
        section: t('navigation:ecosystemSpecies'),
        disabled: pathname === '/ecosystem-species',
      };
    }
    return {
      to: '/records/new',
      label: t('common:actions.addRecord'),
      section: t('navigation:dashboard'),
      disabled: false,
    };
  }, [pathname, t]);

  return (
    <header className="h-16 bg-white/90 border-b border-slate-200 flex items-center backdrop-blur">
      <div className="max-w-7xl mx-auto px-6 w-full flex items-center gap-4">
        <Box sx={{ minWidth: 140 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 1.1 }}>
            {t('common:appName')}
          </Typography>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            {action.section}
          </Typography>
        </Box>
        <SearchBar />
        <div className="ml-auto">
          <Button variant="contained" onClick={() => navigate(action.to)} disabled={action.disabled}>
            {action.label}
          </Button>
        </div>
      </div>
    </header>
  );
}

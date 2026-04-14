
import { useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import { IconButton } from '@mui/material';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import ListAltRoundedIcon from '@mui/icons-material/ListAltRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import ForestRoundedIcon from '@mui/icons-material/ForestRounded';
import PetsRoundedIcon from '@mui/icons-material/PetsRounded';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import HubRoundedIcon from '@mui/icons-material/HubRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import MenuOpenRoundedIcon from '@mui/icons-material/MenuOpenRounded';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';

const NAV_GROUPS = [
  {
    sectionKey: 'sections.overview',
    items: [
      { to: '/', key: 'dashboard', icon: DashboardRoundedIcon },
      { to: '/records', key: 'records', icon: ListAltRoundedIcon },
    ],
  },
  {
    sectionKey: 'sections.taxonomy',
    items: [
      { to: '/traits', key: 'traits', icon: AutoAwesomeRoundedIcon },
      { to: '/biomes', key: 'biomes', icon: ForestRoundedIcon },
      { to: '/species', key: 'species', icon: PetsRoundedIcon },
      { to: '/ecosystems', key: 'ecosystems', icon: PublicRoundedIcon },
    ],
  },
  {
    sectionKey: 'sections.relations',
    items: [
      { to: '/species-traits', key: 'speciesTraits', icon: HubRoundedIcon },
      { to: '/species-biomes', key: 'speciesBiomes', icon: InsightsRoundedIcon },
      { to: '/ecosystem-biomes', key: 'ecosystemBiomes', icon: HubRoundedIcon },
      { to: '/ecosystem-species', key: 'ecosystemSpecies', icon: InsightsRoundedIcon },
    ],
  },
];

export default function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { t } = useTranslation(['navigation', 'common']);
  const navGroups = useMemo(() => {
    return NAV_GROUPS.map((group) => ({
      sectionLabel: t(`navigation:${group.sectionKey}`),
      items: group.items.map(({ to, key, icon }) => ({
        to,
        label: t(`navigation:${key}`),
        icon,
      })),
    }));
  }, [t]);

  return (
    <aside
      className={clsx(
        'border-r border-slate-200 bg-gradient-to-b from-white via-slate-50 to-slate-100 transition-all duration-200 ease-in-out',
        collapsed ? 'w-16' : 'w-72',
      )}
    >
      <div className="h-16 flex items-center justify-between px-3">
        <span className={clsx('font-semibold text-sm tracking-wide text-slate-800', collapsed && 'sr-only')}>
          {t('common:appName')}
        </span>
        <IconButton aria-label={collapsed ? t('navigation:toggleExpand') : t('navigation:toggleCollapse')} onClick={onToggle} size="small">
          {collapsed ? <MenuRoundedIcon fontSize="small" /> : <MenuOpenRoundedIcon fontSize="small" />}
        </IconButton>
      </div>
      <nav className="mt-2 pb-4">
        {navGroups.map((group) => (
          <div key={group.sectionLabel} className="mb-3">
            <p className={clsx('px-4 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500', collapsed && 'sr-only')}>
              {group.sectionLabel}
            </p>
            {group.items.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  clsx(
                    'group flex items-center gap-3 px-3 py-2 mx-2 rounded-lg hover:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500',
                    isActive && 'bg-white text-blue-700 shadow-sm',
                  )
                }
                title={collapsed ? label : undefined}
                aria-label={collapsed ? label : undefined}
              >
                <Icon fontSize="small" className="text-slate-500" />
                <span className={clsx('text-sm font-medium', collapsed && 'sr-only')}>{label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}


import { useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import { HomeIcon, TableCellsIcon, Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import { IconButton } from '@mui/material';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';

const NAV_ENTRIES = [
  { to: '/', key: 'dashboard', icon: HomeIcon },
  { to: '/records', key: 'records', icon: TableCellsIcon },
  { to: '/traits', key: 'traits', icon: TableCellsIcon },
  { to: '/biomes', key: 'biomes', icon: TableCellsIcon },
  { to: '/species', key: 'species', icon: TableCellsIcon },
  { to: '/ecosystems', key: 'ecosystems', icon: TableCellsIcon },
];

export default function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { t } = useTranslation(['navigation', 'common']);
  const navItems = useMemo(
    () =>
      NAV_ENTRIES.map(({ to, key, icon }) => ({
        to,
        label: t(`navigation:${key}`),
        icon,
      })),
    [t],
  );

  return (
    <aside className={clsx('border-r border-gray-200 bg-white transition-all duration-200 ease-in-out', collapsed ? 'w-16' : 'w-60')}>
      <div className="h-14 flex items-center justify-between px-3">
        <span className={clsx('font-semibold text-sm', collapsed && 'sr-only')}>{t('common:appName')}</span>
        <IconButton aria-label={collapsed ? t('navigation:toggleExpand') : t('navigation:toggleCollapse')} onClick={onToggle} size="small">
          {collapsed ? <Bars3Icon className="h-5 w-5" /> : <XMarkIcon className="h-5 w-5" />}
        </IconButton>
      </div>
      <nav className="mt-2">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) =>
            clsx('group flex items-center gap-3 px-3 py-2 mx-2 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500', isActive && 'bg-blue-50 text-blue-700')
          } title={collapsed ? label : undefined} aria-label={collapsed ? label : undefined}>
            <Icon className="h-5 w-5 text-gray-500" /><span className={clsx('text-sm', collapsed && 'sr-only')}>{label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

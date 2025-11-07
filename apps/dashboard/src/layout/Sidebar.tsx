
import { NavLink } from 'react-router-dom';
import { HomeIcon, TableCellsIcon, Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import { IconButton } from '@mui/material';
import clsx from 'clsx';

const NAV = [
  { to: '/', label: 'Dashboard', icon: HomeIcon },
  { to: '/records', label: 'Record', icon: TableCellsIcon },
  { to: '/traits', label: 'Trait', icon: TableCellsIcon },
  { to: '/biomes', label: 'Biomi', icon: TableCellsIcon },
  { to: '/species', label: 'Specie', icon: TableCellsIcon },
  { to: '/ecosystems', label: 'Ecosistemi', icon: TableCellsIcon },
];

export default function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <aside className={clsx('border-r border-gray-200 bg-white transition-all duration-200 ease-in-out', collapsed ? 'w-16' : 'w-60')}>
      <div className="h-14 flex items-center justify-between px-3">
        <span className={clsx('font-semibold text-sm', collapsed && 'sr-only')}>Game</span>
        <IconButton aria-label={collapsed ? 'Espandi sidebar' : 'Comprimi sidebar'} onClick={onToggle} size="small">
          {collapsed ? <Bars3Icon className="h-5 w-5" /> : <XMarkIcon className="h-5 w-5" />}
        </IconButton>
      </div>
      <nav className="mt-2">
        {NAV.map(({ to, label, icon: Icon }) => (
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

import { Outlet } from 'react-router-dom';
import AppShell from './layout/AppShell';
import { SearchProvider } from './providers/SearchProvider';

export default function App() {
  return (
    <SearchProvider>
      <AppShell>
        <Outlet />
      </AppShell>
    </SearchProvider>
  );
}

import SearchBar from '../components/SearchBar';
import { Button } from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';

export default function Topbar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center">
      <div className="max-w-7xl mx-auto px-6 w-full flex items-center gap-3">
        <SearchBar />
        <div className="ml-auto">
          <Button variant="contained" onClick={() => navigate('/records/new')} disabled={pathname === '/records/new'}>Aggiungi</Button>
        </div>
      </div>
    </header>
  );
}

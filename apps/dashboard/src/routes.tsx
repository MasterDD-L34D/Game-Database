
import { createBrowserRouter } from 'react-router-dom';
import App from './App';
import DashboardPage from './pages/DashboardPage';
import Records from './pages/Records';
import RecordCreatePage from './pages/RecordCreatePage';
import Traits from './pages/Traits';
import Biomes from './pages/Biomes';
import SpeciesList from './pages/Species';
import Ecosystems from './pages/Ecosystems';

export const router = createBrowserRouter([
  { path: '/', element: <App />, children: [
    { index: true, element: <DashboardPage /> },
    { path: 'records', element: <Records /> },
    { path: 'records/new', element: <RecordCreatePage /> },
    { path: 'traits', element: <Traits /> },
    { path: 'biomes', element: <Biomes /> },
    { path: 'species', element: <SpeciesList /> },
    { path: 'ecosystems', element: <Ecosystems /> },
  ]},
]);

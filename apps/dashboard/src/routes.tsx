
import { createBrowserRouter } from 'react-router-dom';
import App from './App';
import DashboardPage from './pages/DashboardPage';
import Records from './pages/Records';
import RecordCreatePage from './pages/RecordCreatePage';
import RecordDetailsPage from './features/records/pages/RecordDetailsPage';
import RecordEditPage from './features/records/pages/RecordEditPage';
import TraitListPage from './pages/TraitListPage';
import BiomeListPage from './pages/BiomeListPage';
import SpeciesListPage from './pages/SpeciesListPage';
import EcosystemListPage from './pages/EcosystemListPage';

export const router = createBrowserRouter([
  { path: '/', element: <App />, children: [
    { index: true, element: <DashboardPage /> },
    { path: 'records', element: <Records /> },
    { path: 'records/new', element: <RecordCreatePage /> },
    { path: 'records/:recordId', element: <RecordDetailsPage /> },
    { path: 'records/:recordId/edit', element: <RecordEditPage /> },
    { path: 'traits', element: <TraitListPage /> },
    { path: 'biomes', element: <BiomeListPage /> },
    { path: 'species', element: <SpeciesListPage /> },
    { path: 'ecosystems', element: <EcosystemListPage /> },
  ]},
]);

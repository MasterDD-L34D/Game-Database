
import { createBrowserRouter } from 'react-router-dom';
import App from './App';
import DashboardPage from './pages/DashboardPage';
import Records from './pages/Records';
import RecordCreatePage from './pages/RecordCreatePage';
import RecordDetailsPage from './features/records/pages/RecordDetailsPage';
import RecordEditPage from './features/records/pages/RecordEditPage';
import TraitListPage from './features/taxonomies/pages/TraitListPage';
import BiomeListPage from './features/taxonomies/pages/BiomeListPage';
import SpeciesListPage from './features/taxonomies/pages/SpeciesListPage';
import EcosystemListPage from './features/taxonomies/pages/EcosystemListPage';
import SpeciesTraitListPage from './features/taxonomies/pages/SpeciesTraitListPage';
import SpeciesBiomeListPage from './features/taxonomies/pages/SpeciesBiomeListPage';
import EcosystemBiomeListPage from './features/taxonomies/pages/EcosystemBiomeListPage';
import EcosystemSpeciesListPage from './features/taxonomies/pages/EcosystemSpeciesListPage';

export const router = createBrowserRouter([
  { path: '/', element: <App />, children: [
    { index: true, element: <DashboardPage /> },
    { path: 'records', element: <Records /> },
    { path: 'records/new', element: <RecordCreatePage /> },
    { path: 'records/:recordId?', element: <RecordDetailsPage /> },
    { path: 'records/:recordId/edit', element: <RecordEditPage /> },
    { path: 'traits', element: <TraitListPage /> },
    { path: 'biomes', element: <BiomeListPage /> },
    { path: 'species', element: <SpeciesListPage /> },
    { path: 'ecosystems', element: <EcosystemListPage /> },
    { path: 'species-traits', element: <SpeciesTraitListPage /> },
    { path: 'species-biomes', element: <SpeciesBiomeListPage /> },
    { path: 'ecosystem-biomes', element: <EcosystemBiomeListPage /> },
    { path: 'ecosystem-species', element: <EcosystemSpeciesListPage /> },
  ]},
]);

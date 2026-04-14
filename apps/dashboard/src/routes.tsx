
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
import TraitDetailsPage from './features/taxonomies/pages/TraitDetailsPage';
import BiomeDetailsPage from './features/taxonomies/pages/BiomeDetailsPage';
import SpeciesDetailsPage from './features/taxonomies/pages/SpeciesDetailsPage';
import EcosystemDetailsPage from './features/taxonomies/pages/EcosystemDetailsPage';
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
    { path: 'traits/:traitId', element: <TraitDetailsPage /> },
    { path: 'biomes', element: <BiomeListPage /> },
    { path: 'biomes/:biomeId', element: <BiomeDetailsPage /> },
    { path: 'species', element: <SpeciesListPage /> },
    { path: 'species/:speciesId', element: <SpeciesDetailsPage /> },
    { path: 'ecosystems', element: <EcosystemListPage /> },
    { path: 'ecosystems/:ecosystemId', element: <EcosystemDetailsPage /> },
    { path: 'species-traits', element: <SpeciesTraitListPage /> },
    { path: 'species-biomes', element: <SpeciesBiomeListPage /> },
    { path: 'ecosystem-biomes', element: <EcosystemBiomeListPage /> },
    { path: 'ecosystem-species', element: <EcosystemSpeciesListPage /> },
  ]},
]);

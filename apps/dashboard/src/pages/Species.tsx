
import { ColumnDef, createColumnHelper } from '@tanstack/react-table';
import ListPage from './ListPage';
import type { Species } from '../lib/taxonomy';
import { listSpecies } from '../lib/taxonomy';

const h = createColumnHelper<Species>();
const columns: ColumnDef<Species, any>[] = [
  h.accessor('scientificName', { header: 'Nome scientifico', cell: i => i.getValue() }),
  h.accessor('commonName', { header: 'Nome comune', cell: i => i.getValue() ?? '' }),
  h.accessor('family', { header: 'Famiglia', cell: i => i.getValue() ?? '' }),
  h.accessor('genus', { header: 'Genere', cell: i => i.getValue() ?? '' }),
  h.accessor('status', { header: 'Stato', cell: i => i.getValue() ?? '' }),
];
export default function SpeciesList(){ return <ListPage<Species> title="Specie" columns={columns} fetcher={listSpecies} />; }


import { ColumnDef, createColumnHelper } from '@tanstack/react-table';
import ListPage from './ListPage';
import type { Ecosystem } from '../lib/taxonomy';
import { listEcosystems } from '../lib/taxonomy';

const h = createColumnHelper<Ecosystem>();
const columns: ColumnDef<Ecosystem, any>[] = [
  h.accessor('name', { header: 'Nome', cell: i => i.getValue() }),
  h.accessor('region', { header: 'Regione', cell: i => i.getValue() ?? '' }),
  h.accessor('climate', { header: 'Clima', cell: i => i.getValue() ?? '' }),
  h.accessor('description', { header: 'Descrizione', cell: i => i.getValue() ?? '' }),
];
export default function Ecosystems(){ return <ListPage<Ecosystem> title="Ecosistemi" columns={columns} fetcher={listEcosystems} />; }

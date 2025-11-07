
import { ColumnDef, createColumnHelper } from '@tanstack/react-table';
import ListPage from './ListPage';
import type { Biome } from '../lib/taxonomy';
import { listBiomes } from '../lib/taxonomy';

const h = createColumnHelper<Biome>();
const columns: ColumnDef<Biome, any>[] = [
  h.accessor('name', { header: 'Nome', cell: i => i.getValue() }),
  h.accessor('slug', { header: 'Slug', cell: i => i.getValue() }),
  h.accessor('climate', { header: 'Clima', cell: i => i.getValue() ?? '' }),
  h.accessor('description', { header: 'Descrizione', cell: i => i.getValue() ?? '' }),
];
export default function Biomes(){ return <ListPage<Biome> title="Biomi" columns={columns} fetcher={listBiomes} />; }

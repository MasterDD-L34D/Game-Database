
import { ColumnDef, createColumnHelper } from '@tanstack/react-table';
import ListPage from './ListPage';
import type { Trait } from '../lib/taxonomy';
import { listTraits } from '../lib/taxonomy';

const h = createColumnHelper<Trait>();
const columns: ColumnDef<Trait, any>[] = [
  h.accessor('name', { header: 'Nome', cell: i => i.getValue() }),
  h.accessor('slug', { header: 'Slug', cell: i => i.getValue() }),
  h.accessor('category', { header: 'Categoria', cell: i => i.getValue() ?? '' }),
  h.accessor('dataType', { header: 'Tipo dato', cell: i => i.getValue() }),
  h.accessor('unit', { header: 'Unità', cell: i => i.getValue() ?? '' }),
];
export default function Traits(){ return <ListPage<Trait> title="Trait" columns={columns} fetcher={listTraits} />; }

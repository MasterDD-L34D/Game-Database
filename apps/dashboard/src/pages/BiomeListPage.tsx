import { useCallback, useMemo } from 'react';
import { ColumnDef, createColumnHelper } from '@tanstack/react-table';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ListPage from './ListPage';
import type { Biome } from '../lib/taxonomy';
import { createBiome, deleteBiome, listBiomes, updateBiome } from '../lib/taxonomy';

const DEFAULT_PAGE_SIZE = 25;

const h = createColumnHelper<Biome>();
function parseNumber(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export default function BiomeListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useTranslation('taxonomy');
  const initialQuery = searchParams.get('q') ?? '';
  const initialPage = parseNumber(searchParams.get('page'), 0);
  const initialPageSize = parseNumber(searchParams.get('pageSize'), DEFAULT_PAGE_SIZE);

  const columns = useMemo<ColumnDef<Biome, any>[]>(
    () => [
      h.accessor('name', { header: t('biomes.columns.name'), cell: (i) => i.getValue() }),
      h.accessor('slug', { header: t('biomes.columns.slug'), cell: (i) => i.getValue() }),
      h.accessor('climate', { header: t('biomes.columns.climate'), cell: (i) => i.getValue() ?? '' }),
      h.accessor('description', { header: t('biomes.columns.description'), cell: (i) => i.getValue() ?? '' }),
    ],
    [t],
  );

  const formFields = useMemo(
    () => [
      { name: 'slug', label: t('biomes.form.slug'), required: true },
      { name: 'name', label: t('biomes.form.name'), required: true },
      { name: 'climate', label: t('biomes.form.climate') },
      { name: 'parentId', label: t('biomes.form.parentId') },
      { name: 'description', label: t('biomes.form.description'), type: 'textarea' },
    ],
    [t],
  );

  const defaultValues = useMemo(
    () => ({ slug: '', name: '', climate: '', parentId: '', description: '' }),
    [],
  );

  const normalizeOptional = useCallback((value: string | undefined) => {
    const trimmed = value?.trim() ?? '';
    return trimmed ? trimmed : undefined;
  }, []);

  const mapToValues = useCallback(
    (biome: Biome) => ({
      slug: biome.slug ?? '',
      name: biome.name ?? '',
      climate: biome.climate ?? '',
      parentId: biome.parentId ?? '',
      description: biome.description ?? '',
    }),
    [],
  );

  const mapToPayload = useCallback(
    (values: Record<string, string>) => ({
      slug: values.slug.trim(),
      name: values.name.trim(),
      climate: normalizeOptional(values.climate),
      parentId: normalizeOptional(values.parentId),
      description: normalizeOptional(values.description),
    }),
    [normalizeOptional],
  );

  const handleStateChange = useCallback(
    (state: { query: string; page: number; pageSize: number }) => {
      const nextParams = new URLSearchParams();
      if (state.query) nextParams.set('q', state.query);
      if (state.page > 0) nextParams.set('page', String(state.page));
      if (state.pageSize !== DEFAULT_PAGE_SIZE) nextParams.set('pageSize', String(state.pageSize));
      const current = searchParams.toString();
      const next = nextParams.toString();
      if (current === next) return;
      setSearchParams(nextParams, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  return (
    <ListPage<Biome>
      title={t('biomes.title')}
      columns={columns}
      fetcher={listBiomes}
      queryKeyBase={['biomes']}
      initialQuery={initialQuery}
      initialPage={initialPage}
      initialPageSize={initialPageSize}
      autoloadOnMount
      onStateChange={handleStateChange}
      createConfig={{
        triggerLabel: t('biomes.actions.create'),
        dialogTitle: t('biomes.dialogs.createTitle'),
        submitLabel: t('common:actions.save'),
        defaultValues,
        fields: formFields,
        mutation: async (values) => {
          const payload = mapToPayload(values);
          await createBiome(payload);
        },
        successMessage: t('biomes.feedback.created'),
        errorMessage: t('biomes.feedback.createError'),
      }}
      editConfig={{
        dialogTitle: t('biomes.dialogs.editTitle'),
        submitLabel: t('common:actions.saveChanges'),
        fields: formFields,
        getInitialValues: mapToValues,
        mutation: async (item, values) => {
          if (!item.id) throw new Error('Missing id');
          const payload = mapToPayload(values);
          await updateBiome(item.id, payload);
        },
        successMessage: t('biomes.feedback.updated'),
        errorMessage: t('biomes.feedback.updateError'),
      }}
      deleteConfig={{
        dialogTitle: t('biomes.dialogs.deleteTitle'),
        description: (item) => t('biomes.dialogs.deleteDescription', { name: item.name ?? item.slug }),
        mutation: async (item) => {
          if (!item.id) throw new Error('Missing id');
          await deleteBiome(item.id);
        },
        successMessage: t('biomes.feedback.deleted'),
        errorMessage: t('biomes.feedback.deleteError'),
      }}
      getItemLabel={(item) => item.name ?? item.slug ?? ''}
    />
  );
}

import { useCallback, useMemo } from 'react';
import { ColumnDef, createColumnHelper } from '@tanstack/react-table';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ListPage from './ListPage';
import type { Trait } from '../lib/taxonomy';
import { createTrait, deleteTrait, listTraits, updateTrait } from '../lib/taxonomy';

const DEFAULT_PAGE_SIZE = 25;

const h = createColumnHelper<Trait>();
function parseNumber(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export default function TraitListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useTranslation('taxonomy');
  const initialQuery = searchParams.get('q') ?? '';
  const initialPage = parseNumber(searchParams.get('page'), 0);
  const initialPageSize = parseNumber(searchParams.get('pageSize'), DEFAULT_PAGE_SIZE);

  const columns = useMemo<ColumnDef<Trait, any>[]>(
    () => [
      h.accessor('name', { header: t('traits.columns.name'), cell: (i) => i.getValue() }),
      h.accessor('slug', { header: t('traits.columns.slug'), cell: (i) => i.getValue() }),
      h.accessor('category', { header: t('traits.columns.category'), cell: (i) => i.getValue() ?? '' }),
      h.accessor('dataType', { header: t('traits.columns.dataType'), cell: (i) => i.getValue() }),
      h.accessor('unit', { header: t('traits.columns.unit'), cell: (i) => i.getValue() ?? '' }),
    ],
    [t],
  );

  const formFields = useMemo(
    () => [
      { name: 'slug', label: t('traits.form.slug'), required: true },
      { name: 'name', label: t('traits.form.name'), required: true },
      { name: 'category', label: t('traits.form.category') },
      { name: 'dataType', label: t('traits.form.dataType'), required: true },
      { name: 'unit', label: t('traits.form.unit') },
      { name: 'description', label: t('traits.form.description'), type: 'textarea' },
    ],
    [t],
  );

  const defaultValues = useMemo(
    () => ({ slug: '', name: '', category: '', dataType: '', unit: '', description: '' }),
    [],
  );

  const normalizeOptional = useCallback((value: string | undefined) => {
    const trimmed = value?.trim() ?? '';
    return trimmed ? trimmed : undefined;
  }, []);

  const mapToValues = useCallback(
    (trait: Trait) => ({
      slug: trait.slug ?? '',
      name: trait.name ?? '',
      category: trait.category ?? '',
      dataType: trait.dataType ?? '',
      unit: trait.unit ?? '',
      description: trait.description ?? '',
    }),
    [],
  );

  const mapToPayload = useCallback(
    (values: Record<string, string>) => ({
      slug: values.slug.trim(),
      name: values.name.trim(),
      category: normalizeOptional(values.category),
      dataType: values.dataType.trim(),
      unit: normalizeOptional(values.unit),
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
    <ListPage<Trait>
      title={t('traits.title')}
      columns={columns}
      fetcher={listTraits}
      queryKeyBase={['traits']}
      initialQuery={initialQuery}
      initialPage={initialPage}
      initialPageSize={initialPageSize}
      autoloadOnMount
      onStateChange={handleStateChange}
      createConfig={{
        triggerLabel: t('traits.actions.create'),
        dialogTitle: t('traits.dialogs.createTitle'),
        submitLabel: t('common:actions.save'),
        defaultValues,
        fields: formFields,
        mutation: async (values) => {
          const payload = mapToPayload(values);
          await createTrait(payload);
        },
        successMessage: t('traits.feedback.created'),
        errorMessage: t('traits.feedback.createError'),
      }}
      editConfig={{
        dialogTitle: t('traits.dialogs.editTitle'),
        submitLabel: t('common:actions.saveChanges'),
        fields: formFields,
        getInitialValues: mapToValues,
        mutation: async (item, values) => {
          if (!item.id) throw new Error('Missing id');
          const payload = mapToPayload(values);
          await updateTrait(item.id, payload);
        },
        successMessage: t('traits.feedback.updated'),
        errorMessage: t('traits.feedback.updateError'),
      }}
      deleteConfig={{
        dialogTitle: t('traits.dialogs.deleteTitle'),
        description: (item) => t('traits.dialogs.deleteDescription', { name: item.name ?? item.slug }),
        mutation: async (item) => {
          if (!item.id) throw new Error('Missing id');
          await deleteTrait(item.id);
        },
        successMessage: t('traits.feedback.deleted'),
        errorMessage: t('traits.feedback.deleteError'),
      }}
      getItemLabel={(item) => item.name ?? item.slug ?? ''}
    />
  );
}

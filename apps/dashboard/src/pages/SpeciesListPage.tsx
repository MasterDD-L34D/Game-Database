import { useCallback, useMemo } from 'react';
import { ColumnDef, createColumnHelper } from '@tanstack/react-table';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ListPage from './ListPage';
import type { Species } from '../lib/taxonomy';
import { createSpecies, deleteSpecies, listSpecies, updateSpecies } from '../lib/taxonomy';

const DEFAULT_PAGE_SIZE = 25;

const h = createColumnHelper<Species>();
function parseNumber(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export default function SpeciesListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useTranslation('taxonomy');
  const initialQuery = searchParams.get('q') ?? '';
  const initialPage = parseNumber(searchParams.get('page'), 0);
  const initialPageSize = parseNumber(searchParams.get('pageSize'), DEFAULT_PAGE_SIZE);

  const columns = useMemo<ColumnDef<Species, any>[]>(
    () => [
      h.accessor('scientificName', { header: t('species.columns.scientificName'), cell: (i) => i.getValue() }),
      h.accessor('commonName', { header: t('species.columns.commonName'), cell: (i) => i.getValue() ?? '' }),
      h.accessor('family', { header: t('species.columns.family'), cell: (i) => i.getValue() ?? '' }),
      h.accessor('genus', { header: t('species.columns.genus'), cell: (i) => i.getValue() ?? '' }),
      h.accessor('status', { header: t('species.columns.status'), cell: (i) => i.getValue() ?? '' }),
    ],
    [t],
  );

  const formFields = useMemo(
    () => [
      { name: 'slug', label: t('species.form.slug'), required: true },
      { name: 'scientificName', label: t('species.form.scientificName'), required: true },
      { name: 'commonName', label: t('species.form.commonName') },
      { name: 'family', label: t('species.form.family') },
      { name: 'genus', label: t('species.form.genus') },
      { name: 'status', label: t('species.form.status') },
      { name: 'description', label: t('species.form.description'), type: 'textarea' },
    ],
    [t],
  );

  const defaultValues = useMemo(
    () => ({
      slug: '',
      scientificName: '',
      commonName: '',
      family: '',
      genus: '',
      status: '',
      description: '',
    }),
    [],
  );

  const normalizeOptional = useCallback((value: string | undefined) => {
    const trimmed = value?.trim() ?? '';
    return trimmed ? trimmed : undefined;
  }, []);

  const mapToValues = useCallback(
    (item: Species) => ({
      slug: item.slug ?? '',
      scientificName: item.scientificName ?? '',
      commonName: item.commonName ?? '',
      family: item.family ?? '',
      genus: item.genus ?? '',
      status: item.status ?? '',
      description: item.description ?? '',
    }),
    [],
  );

  const mapToPayload = useCallback(
    (values: Record<string, string>) => ({
      slug: values.slug.trim(),
      scientificName: values.scientificName.trim(),
      commonName: normalizeOptional(values.commonName),
      family: normalizeOptional(values.family),
      genus: normalizeOptional(values.genus),
      status: normalizeOptional(values.status),
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
    <ListPage<Species>
      title={t('species.title')}
      columns={columns}
      fetcher={listSpecies}
      queryKeyBase={['species']}
      initialQuery={initialQuery}
      initialPage={initialPage}
      initialPageSize={initialPageSize}
      autoloadOnMount
      onStateChange={handleStateChange}
      createConfig={{
        triggerLabel: t('species.actions.create'),
        dialogTitle: t('species.dialogs.createTitle'),
        submitLabel: t('common:actions.save'),
        defaultValues,
        fields: formFields,
        mutation: async (values) => {
          const payload = mapToPayload(values);
          await createSpecies(payload);
        },
        successMessage: t('species.feedback.created'),
        errorMessage: t('species.feedback.createError'),
      }}
      editConfig={{
        dialogTitle: t('species.dialogs.editTitle'),
        submitLabel: t('common:actions.saveChanges'),
        fields: formFields,
        getInitialValues: mapToValues,
        mutation: async (item, values) => {
          if (!item.id) throw new Error('Missing id');
          const payload = mapToPayload(values);
          await updateSpecies(item.id, payload);
        },
        successMessage: t('species.feedback.updated'),
        errorMessage: t('species.feedback.updateError'),
      }}
      deleteConfig={{
        dialogTitle: t('species.dialogs.deleteTitle'),
        description: (item) => t('species.dialogs.deleteDescription', { name: item.scientificName ?? item.slug }),
        mutation: async (item) => {
          if (!item.id) throw new Error('Missing id');
          await deleteSpecies(item.id);
        },
        successMessage: t('species.feedback.deleted'),
        errorMessage: t('species.feedback.deleteError'),
      }}
      getItemLabel={(item) => item.scientificName ?? item.commonName ?? item.slug ?? ''}
    />
  );
}

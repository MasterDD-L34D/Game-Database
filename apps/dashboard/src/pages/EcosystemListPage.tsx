import { useCallback, useMemo } from 'react';
import { ColumnDef, createColumnHelper } from '@tanstack/react-table';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import ListPage from './ListPage';
import type { Ecosystem } from '../lib/taxonomy';
import { createEcosystem, deleteEcosystem, listEcosystems, updateEcosystem } from '../lib/taxonomy';

const DEFAULT_PAGE_SIZE = 25;

const h = createColumnHelper<Ecosystem>();
function parseNumber(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export default function EcosystemListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useTranslation('taxonomy');
  const initialQuery = searchParams.get('q') ?? '';
  const initialPage = parseNumber(searchParams.get('page'), 0);
  const initialPageSize = parseNumber(searchParams.get('pageSize'), DEFAULT_PAGE_SIZE);

  const columns = useMemo<ColumnDef<Ecosystem, any>[]>(
    () => [
      h.accessor('name', { header: t('ecosystems.columns.name'), cell: (i) => i.getValue() }),
      h.accessor('region', { header: t('ecosystems.columns.region'), cell: (i) => i.getValue() ?? '' }),
      h.accessor('climate', { header: t('ecosystems.columns.climate'), cell: (i) => i.getValue() ?? '' }),
      h.accessor('description', { header: t('ecosystems.columns.description'), cell: (i) => i.getValue() ?? '' }),
    ],
    [t],
  );

  const formFields = useMemo(
    () => [
      { name: 'slug', label: t('ecosystems.form.slug'), required: true },
      { name: 'name', label: t('ecosystems.form.name'), required: true },
      { name: 'region', label: t('ecosystems.form.region') },
      { name: 'climate', label: t('ecosystems.form.climate') },
      { name: 'description', label: t('ecosystems.form.description'), type: 'textarea' },
    ],
    [t],
  );

  const defaultValues = useMemo(
    () => ({ slug: '', name: '', region: '', climate: '', description: '' }),
    [],
  );

  const normalizeOptional = useCallback((value: string | undefined) => {
    const trimmed = value?.trim() ?? '';
    return trimmed ? trimmed : undefined;
  }, []);

  const mapToValues = useCallback(
    (ecosystem: Ecosystem) => ({
      slug: ecosystem.slug ?? '',
      name: ecosystem.name ?? '',
      region: ecosystem.region ?? '',
      climate: ecosystem.climate ?? '',
      description: ecosystem.description ?? '',
    }),
    [],
  );

  const mapToPayload = useCallback(
    (values: Record<string, string>) => ({
      slug: values.slug.trim(),
      name: values.name.trim(),
      region: normalizeOptional(values.region),
      climate: normalizeOptional(values.climate),
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
    <ListPage<Ecosystem>
      title={t('ecosystems.title')}
      columns={columns}
      fetcher={listEcosystems}
      queryKeyBase={['ecosystems']}
      initialQuery={initialQuery}
      initialPage={initialPage}
      initialPageSize={initialPageSize}
      autoloadOnMount
      onStateChange={handleStateChange}
      createConfig={{
        triggerLabel: t('ecosystems.actions.create'),
        dialogTitle: t('ecosystems.dialogs.createTitle'),
        submitLabel: t('common:actions.save'),
        defaultValues,
        fields: formFields,
        mutation: async (values) => {
          const payload = mapToPayload(values);
          await createEcosystem(payload);
        },
        successMessage: t('ecosystems.feedback.created'),
        errorMessage: t('ecosystems.feedback.createError'),
      }}
      editConfig={{
        dialogTitle: t('ecosystems.dialogs.editTitle'),
        submitLabel: t('common:actions.saveChanges'),
        fields: formFields,
        getInitialValues: mapToValues,
        mutation: async (item, values) => {
          if (!item.id) throw new Error('Missing id');
          const payload = mapToPayload(values);
          await updateEcosystem(item.id, payload);
        },
        successMessage: t('ecosystems.feedback.updated'),
        errorMessage: t('ecosystems.feedback.updateError'),
      }}
      deleteConfig={{
        dialogTitle: t('ecosystems.dialogs.deleteTitle'),
        description: (item) => t('ecosystems.dialogs.deleteDescription', { name: item.name ?? item.slug }),
        mutation: async (item) => {
          if (!item.id) throw new Error('Missing id');
          await deleteEcosystem(item.id);
        },
        successMessage: t('ecosystems.feedback.deleted'),
        errorMessage: t('ecosystems.feedback.deleteError'),
      }}
      getItemLabel={(item) => item.name ?? item.slug ?? ''}
    />
  );
}

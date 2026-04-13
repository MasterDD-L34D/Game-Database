import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ColumnDef, createColumnHelper } from '@tanstack/react-table';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import ListPage from '../../../pages/ListPage';
import { listBiomes, listEcosystems } from '../../../lib/taxonomy';
import {
  createEcosystemBiome,
  deleteEcosystemBiome,
  listEcosystemBiomes,
  updateEcosystemBiome,
  type EcosystemBiomeRelation,
} from '../../../lib/taxonomyRelations';

const DEFAULT_PAGE_SIZE = 25;
const h = createColumnHelper<EcosystemBiomeRelation>();

function parseNumber(value: string | null, fallback: number) {
  if (value === null || value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function parseOptionalNumber(value?: string) {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export default function EcosystemBiomeListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useTranslation('taxonomy');
  const initialQuery = searchParams.get('q') ?? '';
  const initialPage = parseNumber(searchParams.get('page'), 0);
  const initialPageSize = parseNumber(searchParams.get('pageSize'), DEFAULT_PAGE_SIZE);

  const { data: ecosystemsData } = useQuery({
    queryKey: ['ecosystems', 'lookup'],
    queryFn: () => listEcosystems('', 0, 100),
  });
  const { data: biomesData } = useQuery({
    queryKey: ['biomes', 'lookup'],
    queryFn: () => listBiomes('', 0, 100),
  });

  const ecosystemItems = ecosystemsData?.items ?? [];
  const biomeItems = biomesData?.items ?? [];

  const ecosystemsById = useMemo(() => Object.fromEntries(ecosystemItems.map(item => [item.id, item])), [ecosystemItems]);
  const biomesById = useMemo(() => Object.fromEntries(biomeItems.map(item => [item.id, item])), [biomeItems]);

  const columns = useMemo<ColumnDef<EcosystemBiomeRelation, any>[]>(
    () => [
      h.accessor('ecosystemId', {
        header: t('ecosystemBiomes.columns.ecosystem'),
        cell: info => ecosystemsById[info.getValue()]?.name ?? info.getValue(),
      }),
      h.accessor('biomeId', {
        header: t('ecosystemBiomes.columns.biome'),
        cell: info => biomesById[info.getValue()]?.name ?? info.getValue(),
      }),
      h.accessor('proportion', {
        header: t('ecosystemBiomes.columns.proportion'),
        cell: info => (info.getValue() ?? '').toString(),
      }),
      h.accessor('notes', {
        header: t('ecosystemBiomes.columns.notes'),
        cell: info => info.getValue() ?? '',
      }),
    ],
    [biomesById, ecosystemsById, t],
  );

  const ecosystemOptions = useMemo(() => ecosystemItems.map(item => ({ value: item.id, label: item.name })), [ecosystemItems]);
  const biomeOptions = useMemo(() => biomeItems.map(item => ({ value: item.id, label: item.name })), [biomeItems]);

  const relationSchema = useMemo(
    () =>
      z.object({
        ecosystemId: z.string().trim().min(1, t('common:validation.required')),
        biomeId: z.string().trim().min(1, t('common:validation.required')),
        proportion: z.string().optional(),
        notes: z.string().optional(),
      }),
    [t],
  );

  type FormValues = z.infer<typeof relationSchema>;

  const defaultValues = useMemo<FormValues>(() => ({ ecosystemId: '', biomeId: '', proportion: '', notes: '' }), []);

  const formFields = useMemo(
    () => [
      { name: 'ecosystemId', label: t('ecosystemBiomes.form.ecosystem'), required: true, type: 'select', options: ecosystemOptions },
      { name: 'biomeId', label: t('ecosystemBiomes.form.biome'), required: true, type: 'select', options: biomeOptions },
      { name: 'proportion', label: t('ecosystemBiomes.form.proportion'), type: 'number' },
      { name: 'notes', label: t('ecosystemBiomes.form.notes'), type: 'textarea' },
    ],
    [biomeOptions, ecosystemOptions, t],
  );

  const mapToValues = useCallback(
    (item: EcosystemBiomeRelation): FormValues => ({
      ecosystemId: item.ecosystemId,
      biomeId: item.biomeId,
      proportion: item.proportion !== null && item.proportion !== undefined ? String(item.proportion) : '',
      notes: item.notes ?? '',
    }),
    [],
  );

  const mapToPayload = useCallback(
    (values: FormValues) => ({
      ecosystemId: values.ecosystemId,
      biomeId: values.biomeId,
      proportion: parseOptionalNumber(values.proportion),
      notes: values.notes?.trim() ? values.notes.trim() : undefined,
    }),
    [],
  );

  const handleStateChange = useCallback(
    (state: { query: string; page: number; pageSize: number }) => {
      const nextParams = new URLSearchParams();
      if (state.query) nextParams.set('q', state.query);
      if (state.page > 0) nextParams.set('page', String(state.page));
      if (state.pageSize !== DEFAULT_PAGE_SIZE) nextParams.set('pageSize', String(state.pageSize));
      if (searchParams.toString() === nextParams.toString()) return;
      setSearchParams(nextParams, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  return (
    <ListPage<EcosystemBiomeRelation, FormValues>
      title={t('ecosystemBiomes.title')}
      columns={columns}
      fetcher={listEcosystemBiomes}
      queryKeyBase={['ecosystem-biomes']}
      initialQuery={initialQuery}
      initialPage={initialPage}
      initialPageSize={initialPageSize}
      autoloadOnMount
      onStateChange={handleStateChange}
      createConfig={{
        triggerLabel: t('ecosystemBiomes.actions.create'),
        dialogTitle: t('ecosystemBiomes.dialogs.createTitle'),
        submitLabel: t('common:actions.save'),
        defaultValues,
        schema: relationSchema,
        fields: formFields,
        onSubmit: async values => {
          await createEcosystemBiome(mapToPayload(values) as Omit<EcosystemBiomeRelation, 'id'>);
        },
        successMessage: t('ecosystemBiomes.feedback.created'),
        errorMessage: t('ecosystemBiomes.feedback.createError'),
      }}
      editConfig={{
        dialogTitle: t('ecosystemBiomes.dialogs.editTitle'),
        submitLabel: t('common:actions.saveChanges'),
        fields: formFields,
        schema: relationSchema,
        getInitialValues: mapToValues,
        onSubmit: async (item, values) => {
          if (!item.id) throw new Error(t('common:feedback.missingId'));
          await updateEcosystemBiome(item.id, mapToPayload(values));
        },
        successMessage: t('ecosystemBiomes.feedback.updated'),
        errorMessage: t('ecosystemBiomes.feedback.updateError'),
      }}
      deleteConfig={{
        dialogTitle: t('ecosystemBiomes.dialogs.deleteTitle'),
        description: item =>
          t('ecosystemBiomes.dialogs.deleteDescription', {
            ecosystem: ecosystemsById[item.ecosystemId]?.name ?? item.ecosystemId,
            biome: biomesById[item.biomeId]?.name ?? item.biomeId,
          }),
        mutation: async item => {
          if (!item.id) throw new Error(t('common:feedback.missingId'));
          await deleteEcosystemBiome(item.id);
        },
        successMessage: t('ecosystemBiomes.feedback.deleted'),
        errorMessage: t('ecosystemBiomes.feedback.deleteError'),
      }}
      getItemLabel={item => `${ecosystemsById[item.ecosystemId]?.name ?? item.ecosystemId} / ${biomesById[item.biomeId]?.name ?? item.biomeId}`}
    />
  );
}

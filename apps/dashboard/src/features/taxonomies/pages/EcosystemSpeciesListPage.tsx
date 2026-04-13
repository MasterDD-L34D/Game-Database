import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ColumnDef, createColumnHelper } from '@tanstack/react-table';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import ListPage from '../../../pages/ListPage';
import { listEcosystems, listSpecies } from '../../../lib/taxonomy';
import {
  createEcosystemSpecies,
  deleteEcosystemSpecies,
  listEcosystemSpecies,
  updateEcosystemSpecies,
  type EcosystemSpeciesRelation,
} from '../../../lib/taxonomyRelations';

const DEFAULT_PAGE_SIZE = 25;
const ROLE_OPTIONS = ['keystone', 'dominant', 'engineer', 'common', 'invasive', 'other'] as const;
const h = createColumnHelper<EcosystemSpeciesRelation>();

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

export default function EcosystemSpeciesListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useTranslation('taxonomy');
  const initialQuery = searchParams.get('q') ?? '';
  const initialPage = parseNumber(searchParams.get('page'), 0);
  const initialPageSize = parseNumber(searchParams.get('pageSize'), DEFAULT_PAGE_SIZE);

  const { data: ecosystemsData } = useQuery({
    queryKey: ['ecosystems', 'lookup'],
    queryFn: () => listEcosystems('', 0, 100),
  });
  const { data: speciesData } = useQuery({
    queryKey: ['species', 'lookup'],
    queryFn: () => listSpecies('', 0, 100),
  });

  const ecosystemItems = ecosystemsData?.items ?? [];
  const speciesItems = speciesData?.items ?? [];

  const ecosystemsById = useMemo(() => Object.fromEntries(ecosystemItems.map(item => [item.id, item])), [ecosystemItems]);
  const speciesById = useMemo(() => Object.fromEntries(speciesItems.map(item => [item.id, item])), [speciesItems]);

  const columns = useMemo<ColumnDef<EcosystemSpeciesRelation, any>[]>(
    () => [
      h.accessor('ecosystemId', {
        header: t('ecosystemSpecies.columns.ecosystem'),
        cell: info => ecosystemsById[info.getValue()]?.name ?? info.getValue(),
      }),
      h.accessor('speciesId', {
        header: t('ecosystemSpecies.columns.species'),
        cell: info => speciesById[info.getValue()]?.scientificName ?? info.getValue(),
      }),
      h.accessor('role', { header: t('ecosystemSpecies.columns.role'), cell: info => info.getValue() }),
      h.accessor('abundance', {
        header: t('ecosystemSpecies.columns.abundance'),
        cell: info => (info.getValue() ?? '').toString(),
      }),
    ],
    [ecosystemsById, speciesById, t],
  );

  const ecosystemOptions = useMemo(() => ecosystemItems.map(item => ({ value: item.id, label: item.name })), [ecosystemItems]);
  const speciesOptions = useMemo(() => speciesItems.map(item => ({ value: item.id, label: item.scientificName })), [speciesItems]);

  const relationSchema = useMemo(
    () =>
      z.object({
        ecosystemId: z.string().trim().min(1, t('common:validation.required')),
        speciesId: z.string().trim().min(1, t('common:validation.required')),
        role: z.enum(ROLE_OPTIONS),
        abundance: z.string().optional(),
        notes: z.string().optional(),
      }),
    [t],
  );

  type FormValues = z.infer<typeof relationSchema>;

  const defaultValues = useMemo<FormValues>(
    () => ({ ecosystemId: '', speciesId: '', role: 'common', abundance: '', notes: '' }),
    [],
  );

  const formFields = useMemo(
    () => [
      { name: 'ecosystemId', label: t('ecosystemSpecies.form.ecosystem'), required: true, type: 'select', options: ecosystemOptions },
      { name: 'speciesId', label: t('ecosystemSpecies.form.species'), required: true, type: 'select', options: speciesOptions },
      { name: 'role', label: t('ecosystemSpecies.form.role'), required: true, type: 'select', options: ROLE_OPTIONS.map(option => ({ value: option, label: option })) },
      { name: 'abundance', label: t('ecosystemSpecies.form.abundance'), type: 'number' },
      { name: 'notes', label: t('ecosystemSpecies.form.notes'), type: 'textarea' },
    ],
    [ecosystemOptions, speciesOptions, t],
  );

  const mapToValues = useCallback(
    (item: EcosystemSpeciesRelation): FormValues => ({
      ecosystemId: item.ecosystemId,
      speciesId: item.speciesId,
      role: item.role,
      abundance: item.abundance !== null && item.abundance !== undefined ? String(item.abundance) : '',
      notes: item.notes ?? '',
    }),
    [],
  );

  const mapToPayload = useCallback(
    (values: FormValues) => ({
      ecosystemId: values.ecosystemId,
      speciesId: values.speciesId,
      role: values.role,
      abundance: parseOptionalNumber(values.abundance),
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
    <ListPage<EcosystemSpeciesRelation, FormValues>
      title={t('ecosystemSpecies.title')}
      columns={columns}
      fetcher={listEcosystemSpecies}
      queryKeyBase={['ecosystem-species']}
      initialQuery={initialQuery}
      initialPage={initialPage}
      initialPageSize={initialPageSize}
      autoloadOnMount
      onStateChange={handleStateChange}
      createConfig={{
        triggerLabel: t('ecosystemSpecies.actions.create'),
        dialogTitle: t('ecosystemSpecies.dialogs.createTitle'),
        submitLabel: t('common:actions.save'),
        defaultValues,
        schema: relationSchema,
        fields: formFields,
        onSubmit: async values => {
          await createEcosystemSpecies(mapToPayload(values) as Omit<EcosystemSpeciesRelation, 'id'>);
        },
        successMessage: t('ecosystemSpecies.feedback.created'),
        errorMessage: t('ecosystemSpecies.feedback.createError'),
      }}
      editConfig={{
        dialogTitle: t('ecosystemSpecies.dialogs.editTitle'),
        submitLabel: t('common:actions.saveChanges'),
        fields: formFields,
        schema: relationSchema,
        getInitialValues: mapToValues,
        onSubmit: async (item, values) => {
          if (!item.id) throw new Error(t('common:feedback.missingId'));
          await updateEcosystemSpecies(item.id, mapToPayload(values));
        },
        successMessage: t('ecosystemSpecies.feedback.updated'),
        errorMessage: t('ecosystemSpecies.feedback.updateError'),
      }}
      deleteConfig={{
        dialogTitle: t('ecosystemSpecies.dialogs.deleteTitle'),
        description: item =>
          t('ecosystemSpecies.dialogs.deleteDescription', {
            ecosystem: ecosystemsById[item.ecosystemId]?.name ?? item.ecosystemId,
            species: speciesById[item.speciesId]?.scientificName ?? item.speciesId,
          }),
        mutation: async item => {
          if (!item.id) throw new Error(t('common:feedback.missingId'));
          await deleteEcosystemSpecies(item.id);
        },
        successMessage: t('ecosystemSpecies.feedback.deleted'),
        errorMessage: t('ecosystemSpecies.feedback.deleteError'),
      }}
      getItemLabel={item => `${ecosystemsById[item.ecosystemId]?.name ?? item.ecosystemId} / ${speciesById[item.speciesId]?.scientificName ?? item.speciesId}`}
    />
  );
}

import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ColumnDef, createColumnHelper } from '@tanstack/react-table';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import ListPage from '../../../pages/ListPage';
import { listBiomes, listSpecies } from '../../../lib/taxonomy';
import {
  createSpeciesBiome,
  deleteSpeciesBiome,
  listSpeciesBiomes,
  updateSpeciesBiome,
  type SpeciesBiomeRelation,
} from '../../../lib/taxonomyRelations';

const DEFAULT_PAGE_SIZE = 20;
const PRESENCE_OPTIONS = ['resident', 'migrant', 'introduced', 'endemic', 'unknown'] as const;
const h = createColumnHelper<SpeciesBiomeRelation>();

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

export default function SpeciesBiomeListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useTranslation('taxonomy');
  const initialQuery = searchParams.get('q') ?? '';
  const initialPage = parseNumber(searchParams.get('page'), 0);
  const initialPageSize = parseNumber(searchParams.get('pageSize'), DEFAULT_PAGE_SIZE);
  const initialSort = searchParams.get('sort') ?? '';

  const { data: speciesData } = useQuery({
    queryKey: ['species', 'lookup'],
    queryFn: () => listSpecies('', 0, 100),
  });
  const { data: biomesData } = useQuery({
    queryKey: ['biomes', 'lookup'],
    queryFn: () => listBiomes('', 0, 100),
  });

  const speciesItems = speciesData?.items ?? [];
  const biomeItems = biomesData?.items ?? [];

  const speciesById = useMemo(() => Object.fromEntries(speciesItems.map(item => [item.id, item])), [speciesItems]);
  const biomesById = useMemo(() => Object.fromEntries(biomeItems.map(item => [item.id, item])), [biomeItems]);

  const columns = useMemo<ColumnDef<SpeciesBiomeRelation, any>[]>(
    () => [
      h.accessor('speciesId', {
        header: t('speciesBiomes.columns.species'),
        cell: info => speciesById[info.getValue()]?.scientificName ?? info.getValue(),
      }),
      h.accessor('biomeId', {
        header: t('speciesBiomes.columns.biome'),
        cell: info => biomesById[info.getValue()]?.name ?? info.getValue(),
      }),
      h.accessor('presence', { header: t('speciesBiomes.columns.presence'), cell: info => info.getValue() }),
      h.accessor('abundance', {
        header: t('speciesBiomes.columns.abundance'),
        cell: info => (info.getValue() ?? '').toString(),
      }),
    ],
    [biomesById, speciesById, t],
  );

  const speciesOptions = useMemo(() => speciesItems.map(item => ({ value: item.id, label: item.scientificName })), [speciesItems]);
  const biomeOptions = useMemo(() => biomeItems.map(item => ({ value: item.id, label: item.name })), [biomeItems]);

  const relationSchema = useMemo(
    () =>
      z.object({
        speciesId: z.string().trim().min(1, t('common:validation.required')),
        biomeId: z.string().trim().min(1, t('common:validation.required')),
        presence: z.enum(PRESENCE_OPTIONS),
        abundance: z.string().optional(),
        notes: z.string().optional(),
      }),
    [t],
  );

  type FormValues = z.infer<typeof relationSchema>;

  const defaultValues = useMemo<FormValues>(
    () => ({ speciesId: '', biomeId: '', presence: 'resident', abundance: '', notes: '' }),
    [],
  );

  const formFields = useMemo(
    () => [
      { name: 'speciesId', label: t('speciesBiomes.form.species'), required: true, type: 'select', options: speciesOptions },
      { name: 'biomeId', label: t('speciesBiomes.form.biome'), required: true, type: 'select', options: biomeOptions },
      { name: 'presence', label: t('speciesBiomes.form.presence'), required: true, type: 'select', options: PRESENCE_OPTIONS.map(option => ({ value: option, label: option })) },
      { name: 'abundance', label: t('speciesBiomes.form.abundance'), type: 'number' },
      { name: 'notes', label: t('speciesBiomes.form.notes'), type: 'textarea' },
    ],
    [biomeOptions, speciesOptions, t],
  );

  const mapToValues = useCallback(
    (item: SpeciesBiomeRelation): FormValues => ({
      speciesId: item.speciesId,
      biomeId: item.biomeId,
      presence: item.presence,
      abundance: item.abundance !== null && item.abundance !== undefined ? String(item.abundance) : '',
      notes: item.notes ?? '',
    }),
    [],
  );

  const mapToPayload = useCallback(
    (values: FormValues) => ({
      speciesId: values.speciesId,
      biomeId: values.biomeId,
      presence: values.presence,
      abundance: parseOptionalNumber(values.abundance),
      notes: values.notes?.trim() ? values.notes.trim() : undefined,
    }),
    [],
  );

  const handleStateChange = useCallback(
    (state: { query: string; page: number; pageSize: number; sort: string }) => {
      const nextParams = new URLSearchParams();
      if (state.query) nextParams.set('q', state.query);
      if (state.page > 0) nextParams.set('page', String(state.page));
      if (state.pageSize !== DEFAULT_PAGE_SIZE) nextParams.set('pageSize', String(state.pageSize));
      if (state.sort) nextParams.set('sort', state.sort);
      if (searchParams.toString() === nextParams.toString()) return;
      setSearchParams(nextParams, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  return (
    <ListPage<SpeciesBiomeRelation, FormValues>
      title={t('speciesBiomes.title')}
      columns={columns}
      fetcher={listSpeciesBiomes}
      queryKeyBase={['species-biomes']}
      initialQuery={initialQuery}
      initialPage={initialPage}
      initialPageSize={initialPageSize}
      initialSort={initialSort}
      autoloadOnMount
      onStateChange={handleStateChange}
      createConfig={{
        triggerLabel: t('speciesBiomes.actions.create'),
        dialogTitle: t('speciesBiomes.dialogs.createTitle'),
        submitLabel: t('common:actions.save'),
        defaultValues,
        schema: relationSchema,
        fields: formFields,
        onSubmit: async values => {
          await createSpeciesBiome(mapToPayload(values) as Omit<SpeciesBiomeRelation, 'id'>);
        },
        successMessage: t('speciesBiomes.feedback.created'),
        errorMessage: t('speciesBiomes.feedback.createError'),
      }}
      editConfig={{
        dialogTitle: t('speciesBiomes.dialogs.editTitle'),
        submitLabel: t('common:actions.saveChanges'),
        fields: formFields,
        schema: relationSchema,
        getInitialValues: mapToValues,
        onSubmit: async (item, values) => {
          if (!item.id) throw new Error(t('common:feedback.missingId'));
          await updateSpeciesBiome(item.id, mapToPayload(values));
        },
        successMessage: t('speciesBiomes.feedback.updated'),
        errorMessage: t('speciesBiomes.feedback.updateError'),
      }}
      deleteConfig={{
        dialogTitle: t('speciesBiomes.dialogs.deleteTitle'),
        description: item =>
          t('speciesBiomes.dialogs.deleteDescription', {
            species: speciesById[item.speciesId]?.scientificName ?? item.speciesId,
            biome: biomesById[item.biomeId]?.name ?? item.biomeId,
          }),
        mutation: async item => {
          if (!item.id) throw new Error(t('common:feedback.missingId'));
          await deleteSpeciesBiome(item.id);
        },
        successMessage: t('speciesBiomes.feedback.deleted'),
        errorMessage: t('speciesBiomes.feedback.deleteError'),
      }}
      getItemLabel={item => `${speciesById[item.speciesId]?.scientificName ?? item.speciesId} / ${biomesById[item.biomeId]?.name ?? item.biomeId}`}
    />
  );
}

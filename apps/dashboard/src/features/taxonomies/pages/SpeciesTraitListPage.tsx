import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ColumnDef, createColumnHelper } from '@tanstack/react-table';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import ListPage from '../../../pages/ListPage';
import { listSpecies, listTraits, type Trait } from '../../../lib/taxonomy';
import {
  createSpeciesTrait,
  deleteSpeciesTrait,
  listSpeciesTraits,
  updateSpeciesTrait,
  type SpeciesTraitRelation,
} from '../../../lib/taxonomyRelations';

const DEFAULT_PAGE_SIZE = 25;
const h = createColumnHelper<SpeciesTraitRelation>();

function parseNumber(value: string | null, fallback: number) {
  if (value === null || value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function normalizeNumericString(value?: string) {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function summarizeValue(item: SpeciesTraitRelation) {
  if (item.bool !== null && item.bool !== undefined) return item.bool ? 'true' : 'false';
  if (item.num !== null && item.num !== undefined) return `${item.num}${item.unit ? ` ${item.unit}` : ''}`;
  if (item.text) return item.text;
  if (typeof item.value === 'string') return item.value;
  return '';
}

export default function SpeciesTraitListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useTranslation('taxonomy');
  const initialQuery = searchParams.get('q') ?? '';
  const initialPage = parseNumber(searchParams.get('page'), 0);
  const initialPageSize = parseNumber(searchParams.get('pageSize'), DEFAULT_PAGE_SIZE);

  const { data: speciesData } = useQuery({
    queryKey: ['species', 'lookup'],
    queryFn: () => listSpecies('', 0, 100),
  });
  const { data: traitsData } = useQuery({
    queryKey: ['traits', 'lookup'],
    queryFn: () => listTraits('', 0, 100),
  });

  const speciesItems = speciesData?.items ?? [];
  const traitItems = traitsData?.items ?? [];

  const speciesById = useMemo(() => Object.fromEntries(speciesItems.map(item => [item.id, item])), [speciesItems]);
  const traitsById = useMemo(() => Object.fromEntries(traitItems.map(item => [item.id, item])), [traitItems]);

  const columns = useMemo<ColumnDef<SpeciesTraitRelation, any>[]>(
    () => [
      h.accessor('speciesId', {
        header: t('speciesTraits.columns.species'),
        cell: info => speciesById[info.getValue()]?.scientificName ?? info.getValue(),
      }),
      h.accessor('traitId', {
        header: t('speciesTraits.columns.trait'),
        cell: info => traitsById[info.getValue()]?.name ?? info.getValue(),
      }),
      h.accessor('category', { header: t('speciesTraits.columns.category'), cell: info => info.getValue() ?? '' }),
      h.display({
        id: 'valueSummary',
        header: t('speciesTraits.columns.value'),
        cell: ({ row }) => summarizeValue(row.original),
      }),
    ],
    [speciesById, t, traitsById],
  );

  const speciesOptions = useMemo(() => speciesItems.map(item => ({ value: item.id, label: item.scientificName })), [speciesItems]);
  const traitOptions = useMemo(() => traitItems.map(item => ({ value: item.id, label: item.name })), [traitItems]);

  const relationSchema = useMemo(
    () =>
      z
        .object({
          speciesId: z.string().trim().min(1, t('common:validation.required')),
          traitId: z.string().trim().min(1, t('common:validation.required')),
          category: z.string().trim().optional(),
          boolValue: z.string().trim().optional(),
          numValue: z.string().trim().optional(),
          confidence: z.string().trim().optional(),
          unit: z.string().trim().optional(),
          textValue: z.string().trim().optional(),
          source: z.string().trim().optional(),
          categoricalValue: z.string().trim().optional(),
        })
        .superRefine((values, ctx) => {
          const trait = traitsById[values.traitId] as Trait | undefined;
          if (!trait) return;

          if (trait.dataType === 'BOOLEAN' && !values.boolValue) {
            ctx.addIssue({ path: ['boolValue'], code: z.ZodIssueCode.custom, message: t('common:validation.required') });
          }
          if (trait.dataType === 'NUMERIC' && !values.numValue?.trim()) {
            ctx.addIssue({ path: ['numValue'], code: z.ZodIssueCode.custom, message: t('common:validation.required') });
          }
          if (trait.dataType === 'TEXT' && !values.textValue?.trim()) {
            ctx.addIssue({ path: ['textValue'], code: z.ZodIssueCode.custom, message: t('common:validation.required') });
          }
          if (trait.dataType === 'CATEGORICAL' && !values.categoricalValue?.trim()) {
            ctx.addIssue({ path: ['categoricalValue'], code: z.ZodIssueCode.custom, message: t('common:validation.required') });
          }
        }),
    [t, traitsById],
  );

  type FormValues = z.infer<typeof relationSchema>;

  const defaultValues = useMemo<FormValues>(
    () => ({
      speciesId: '',
      traitId: '',
      category: '',
      boolValue: '',
      numValue: '',
      confidence: '',
      unit: '',
      textValue: '',
      source: '',
      categoricalValue: '',
    }),
    [],
  );

  const dataTypeFor = (values: FormValues) => (traitsById[values.traitId] as Trait | undefined)?.dataType;

  const formFields = useMemo(
    () => [
      { name: 'speciesId', label: t('speciesTraits.form.species'), required: true, type: 'select', options: speciesOptions },
      { name: 'traitId', label: t('speciesTraits.form.trait'), required: true, type: 'select', options: traitOptions },
      { name: 'category', label: t('speciesTraits.form.category') },
      {
        name: 'boolValue',
        label: t('speciesTraits.form.boolValue'),
        type: 'select',
        options: [{ value: 'true', label: 'true' }, { value: 'false', label: 'false' }],
        showIf: (values: FormValues) => dataTypeFor(values) === 'BOOLEAN',
      },
      {
        name: 'numValue',
        label: t('speciesTraits.form.numValue'),
        type: 'number',
        showIf: (values: FormValues) => dataTypeFor(values) === 'NUMERIC',
      },
      {
        name: 'confidence',
        label: t('speciesTraits.form.confidence'),
        type: 'number',
        showIf: (values: FormValues) => dataTypeFor(values) === 'NUMERIC',
      },
      {
        name: 'unit',
        label: t('speciesTraits.form.unit'),
        showIf: (values: FormValues) => dataTypeFor(values) === 'NUMERIC',
      },
      {
        name: 'categoricalValue',
        label: t('speciesTraits.form.categoricalValue'),
        showIf: (values: FormValues) => dataTypeFor(values) === 'CATEGORICAL',
      },
      {
        name: 'textValue',
        label: t('speciesTraits.form.textValue'),
        type: 'textarea',
        showIf: (values: FormValues) => {
          const dataType = dataTypeFor(values);
          return dataType === 'TEXT' || dataType === 'CATEGORICAL';
        },
      },
      {
        name: 'source',
        label: t('speciesTraits.form.source'),
        showIf: (values: FormValues) => {
          const dataType = dataTypeFor(values);
          return dataType === 'TEXT' || dataType === 'NUMERIC';
        },
      },
    ],
    [speciesOptions, t, traitOptions, traitsById],
  );

  const mapToValues = useCallback(
    (item: SpeciesTraitRelation): FormValues => {
      const trait = traitsById[item.traitId] as Trait | undefined;
      return {
        speciesId: item.speciesId ?? '',
        traitId: item.traitId ?? '',
        category: item.category ?? '',
        boolValue: trait?.dataType === 'BOOLEAN' && item.bool !== null && item.bool !== undefined ? String(item.bool) : '',
        numValue: trait?.dataType === 'NUMERIC' && item.num !== null && item.num !== undefined ? String(item.num) : '',
        confidence: trait?.dataType === 'NUMERIC' && item.confidence !== null && item.confidence !== undefined ? String(item.confidence) : '',
        unit: item.unit ?? '',
        textValue: item.text ?? '',
        source: item.source ?? '',
        categoricalValue: typeof item.value === 'string' ? item.value : '',
      };
    },
    [traitsById],
  );

  const mapToPayload = useCallback(
    (values: FormValues) => {
      const trait = traitsById[values.traitId] as Trait | undefined;
      const payload: Record<string, unknown> = { speciesId: values.speciesId, traitId: values.traitId };
      if (values.category?.trim()) payload.category = values.category.trim();
      if (!trait) return payload;

      if (trait.dataType === 'BOOLEAN') {
        payload.bool = values.boolValue === 'true';
      }
      if (trait.dataType === 'NUMERIC') {
        payload.num = normalizeNumericString(values.numValue);
        payload.confidence = normalizeNumericString(values.confidence);
        if (values.unit?.trim()) payload.unit = values.unit.trim();
        if (values.source?.trim()) payload.source = values.source.trim();
      }
      if (trait.dataType === 'TEXT') {
        if (values.textValue?.trim()) payload.text = values.textValue.trim();
        if (values.source?.trim()) payload.source = values.source.trim();
      }
      if (trait.dataType === 'CATEGORICAL') {
        if (values.categoricalValue?.trim()) payload.value = values.categoricalValue.trim();
        if (values.textValue?.trim()) payload.text = values.textValue.trim();
      }
      return payload;
    },
    [traitsById],
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
    <ListPage<SpeciesTraitRelation, FormValues>
      title={t('speciesTraits.title')}
      columns={columns}
      fetcher={listSpeciesTraits}
      queryKeyBase={['species-traits']}
      initialQuery={initialQuery}
      initialPage={initialPage}
      initialPageSize={initialPageSize}
      autoloadOnMount
      onStateChange={handleStateChange}
      createConfig={{
        triggerLabel: t('speciesTraits.actions.create'),
        dialogTitle: t('speciesTraits.dialogs.createTitle'),
        submitLabel: t('common:actions.save'),
        defaultValues,
        schema: relationSchema,
        fields: formFields,
        onSubmit: async values => {
          await createSpeciesTrait(mapToPayload(values) as Omit<SpeciesTraitRelation, 'id'>);
        },
        successMessage: t('speciesTraits.feedback.created'),
        errorMessage: t('speciesTraits.feedback.createError'),
      }}
      editConfig={{
        dialogTitle: t('speciesTraits.dialogs.editTitle'),
        submitLabel: t('common:actions.saveChanges'),
        fields: formFields,
        schema: relationSchema,
        getInitialValues: mapToValues,
        onSubmit: async (item, values) => {
          if (!item.id) throw new Error(t('common:feedback.missingId'));
          await updateSpeciesTrait(item.id, mapToPayload(values));
        },
        successMessage: t('speciesTraits.feedback.updated'),
        errorMessage: t('speciesTraits.feedback.updateError'),
      }}
      deleteConfig={{
        dialogTitle: t('speciesTraits.dialogs.deleteTitle'),
        description: item =>
          t('speciesTraits.dialogs.deleteDescription', {
            species: speciesById[item.speciesId]?.scientificName ?? item.speciesId,
            trait: traitsById[item.traitId]?.name ?? item.traitId,
          }),
        mutation: async item => {
          if (!item.id) throw new Error(t('common:feedback.missingId'));
          await deleteSpeciesTrait(item.id);
        },
        successMessage: t('speciesTraits.feedback.deleted'),
        errorMessage: t('speciesTraits.feedback.deleteError'),
      }}
      getItemLabel={item => `${speciesById[item.speciesId]?.scientificName ?? item.speciesId} / ${traitsById[item.traitId]?.name ?? item.traitId}`}
    />
  );
}

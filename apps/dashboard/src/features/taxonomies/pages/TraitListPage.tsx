import { useCallback, useMemo } from 'react';
import { ColumnDef, createColumnHelper } from '@tanstack/react-table';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import ListPage from '../../../pages/ListPage';
import type { Trait } from '../../../lib/taxonomy';
import { createTrait, deleteTrait, listTraits, updateTrait } from '../../../lib/taxonomy';

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

  const traitSchema = useMemo(
    () =>
      z
        .object({
          slug: z.string().trim().min(1, t('common:validation.required')),
          name: z.string().trim().min(1, t('common:validation.required')),
          category: z.string().trim().optional(),
          dataType: z.enum(['BOOLEAN', 'NUMERIC', 'CATEGORICAL', 'TEXT'], {
            required_error: t('common:validation.required'),
          }),
          unit: z.string().trim().optional(),
          description: z.string().trim().optional(),
          allowedValues: z.string().optional(),
          rangeMin: z.string().optional(),
          rangeMax: z.string().optional(),
        })
        .superRefine((values, ctx) => {
          const parseNumber = (value?: string | null) => {
            if (!value) return null;
            const trimmed = value.trim();
            if (!trimmed) return null;
            const parsed = Number(trimmed);
            return Number.isFinite(parsed) ? parsed : Number.NaN;
          };

          if (values.dataType === 'CATEGORICAL') {
            const tokens = (values.allowedValues ?? '')
              .split(/[\n,]+/)
              .map((token) => token.trim())
              .filter(Boolean);
            if (tokens.length === 0) {
              ctx.addIssue({
                path: ['allowedValues'],
                code: z.ZodIssueCode.custom,
                message: t('traits.validation.allowedValuesRequired'),
              });
            }
          } else if (values.allowedValues && values.allowedValues.trim().length > 0) {
            ctx.addIssue({
              path: ['allowedValues'],
              code: z.ZodIssueCode.custom,
              message: t('traits.validation.allowedValuesOnlyCategorical'),
            });
          }

          if (values.dataType === 'NUMERIC') {
            const min = parseNumber(values.rangeMin);
            const max = parseNumber(values.rangeMax);
            if (Number.isNaN(min) || Number.isNaN(max)) {
              ctx.addIssue({
                path: ['rangeMin'],
                code: z.ZodIssueCode.custom,
                message: t('traits.validation.numericRangeFormat'),
              });
              return;
            }
            if (min !== null && max !== null && min > max) {
              ctx.addIssue({
                path: ['rangeMax'],
                code: z.ZodIssueCode.custom,
                message: t('traits.validation.numericRangeOrder'),
              });
            }
          } else if ((values.rangeMin && values.rangeMin.trim()) || (values.rangeMax && values.rangeMax.trim())) {
            ctx.addIssue({
              path: ['rangeMin'],
              code: z.ZodIssueCode.custom,
              message: t('traits.validation.numericRangeOnlyNumeric'),
            });
          }
        }),
    [t],
  );

  type TraitFormValues = z.infer<typeof traitSchema>;

  const defaultValues = useMemo<TraitFormValues>(
    () => ({
      slug: '',
      name: '',
      category: '',
      dataType: 'TEXT',
      unit: '',
      description: '',
      allowedValues: '',
      rangeMin: '',
      rangeMax: '',
    }),
    [],
  );

  const dataTypeOptions = useMemo(
    () => [
      { value: 'BOOLEAN', label: t('traits.dataTypes.boolean') },
      { value: 'NUMERIC', label: t('traits.dataTypes.numeric') },
      { value: 'CATEGORICAL', label: t('traits.dataTypes.categorical') },
      { value: 'TEXT', label: t('traits.dataTypes.text') },
    ],
    [t],
  );

  const formFields = useMemo(
    () => [
      { name: 'slug', label: t('traits.form.slug'), required: true },
      { name: 'name', label: t('traits.form.name'), required: true },
      { name: 'category', label: t('traits.form.category') },
      { name: 'dataType', label: t('traits.form.dataType'), required: true, type: 'select', options: dataTypeOptions },
      { name: 'unit', label: t('traits.form.unit') },
      { name: 'description', label: t('traits.form.description'), type: 'textarea' },
      {
        name: 'allowedValues',
        label: t('traits.form.allowedValues'),
        type: 'textarea',
        helperText: t('traits.form.allowedValuesHint'),
        showIf: (values: TraitFormValues) => values.dataType === 'CATEGORICAL',
      },
      {
        name: 'rangeMin',
        label: t('traits.form.rangeMin'),
        type: 'number',
        helperText: t('traits.form.rangeHint'),
        showIf: (values: TraitFormValues) => values.dataType === 'NUMERIC',
      },
      {
        name: 'rangeMax',
        label: t('traits.form.rangeMax'),
        type: 'number',
        helperText: t('traits.form.rangeHint'),
        showIf: (values: TraitFormValues) => values.dataType === 'NUMERIC',
      },
    ],
    [dataTypeOptions, t],
  );

  const mapToValues = useCallback(
    (trait: Trait): TraitFormValues => ({
      slug: trait.slug ?? '',
      name: trait.name ?? '',
      category: trait.category ?? '',
      dataType: trait.dataType ?? 'TEXT',
      unit: trait.unit ?? '',
      description: trait.description ?? '',
      allowedValues: Array.isArray(trait.allowedValues) ? trait.allowedValues.join(', ') : '',
      rangeMin:
        trait.dataType === 'NUMERIC' && trait.rangeMin !== null && trait.rangeMin !== undefined
          ? String(trait.rangeMin)
          : '',
      rangeMax:
        trait.dataType === 'NUMERIC' && trait.rangeMax !== null && trait.rangeMax !== undefined
          ? String(trait.rangeMax)
          : '',
    }),
    [],
  );

  const mapToPayload = useCallback(
    (values: TraitFormValues) => {
      const optional = (value?: string) => {
        const trimmed = value?.trim() ?? '';
        return trimmed ? trimmed : undefined;
      };

      const parseNumeric = (value?: string) => {
        const trimmed = value?.trim() ?? '';
        if (!trimmed) return null;
        const parsed = Number(trimmed);
        return Number.isFinite(parsed) ? parsed : null;
      };

      const allowedValues =
        values.dataType === 'CATEGORICAL'
          ? (values.allowedValues ?? '')
              .split(/[\n,]+/)
              .map((token) => token.trim())
              .filter(Boolean)
          : undefined;

      const rangeMin = values.dataType === 'NUMERIC' ? parseNumeric(values.rangeMin) : null;
      const rangeMax = values.dataType === 'NUMERIC' ? parseNumeric(values.rangeMax) : null;

      return {
        slug: values.slug.trim(),
        name: values.name.trim(),
        category: optional(values.category),
        dataType: values.dataType,
        unit: optional(values.unit),
        description: optional(values.description),
        allowedValues,
        rangeMin,
        rangeMax,
      };
    },
    [],
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
    <ListPage<Trait, TraitFormValues>
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
        schema: traitSchema,
        fields: formFields,
        onSubmit: async (values) => {
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
        schema: traitSchema,
        getInitialValues: mapToValues,
        onSubmit: async (item, values) => {
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

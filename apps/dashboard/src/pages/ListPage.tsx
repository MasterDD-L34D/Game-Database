import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { ColumnDef, type PaginationState } from '@tanstack/react-table';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm, type UseFormReturn } from 'react-hook-form';
import type { z } from 'zod';
import { useTranslation } from 'react-i18next';
import DataTable from '../components/data-table/DataTable';
import RowActionsMenu from '../components/data-table/RowActionsMenu';
import { useSnackbar } from '../components/SnackbarProvider';
import { useSearch } from '../providers/SearchProvider';
import { createZodResolver } from '../lib/zodResolver';

type Fetcher<T> = (q: string, page?: number, pageSize?: number) => Promise<{ items: T[]; page: number; pageSize: number; total: number }>;

type CriteriaState = { query: string; page: number; pageSize: number };

type FormFieldConfig<TValues extends Record<string, any>> = {
  name: keyof TValues & string;
  label: string;
  required?: boolean;
  type?: 'text' | 'number' | 'textarea' | 'select';
  helperText?: string;
  options?: { label: string; value: string }[];
  showIf?: (values: TValues) => boolean;
};

type CreateConfig<TValues extends Record<string, any>> = {
  triggerLabel?: string;
  dialogTitle: string;
  submitLabel?: string;
  defaultValues: TValues;
  schema: z.ZodType<TValues>;
  fields: FormFieldConfig<TValues>[];
  onSubmit: (values: TValues) => Promise<unknown>;
  successMessage?: string;
  errorMessage?: string;
};

type EditConfig<TItem, TValues extends Record<string, any>> = {
  dialogTitle: string;
  submitLabel?: string;
  defaultValues?: TValues;
  fields: FormFieldConfig<TValues>[];
  schema: z.ZodType<TValues>;
  getInitialValues: (item: TItem) => TValues;
  onSubmit: (item: TItem, values: TValues) => Promise<unknown>;
  successMessage?: string;
  errorMessage?: string;
};

type DeleteConfig<T> = {
  dialogTitle?: string;
  description?: (item: T) => string;
  confirmLabel?: string;
  mutation: (item: T) => Promise<unknown>;
  successMessage?: string;
  errorMessage?: string;
};

type ListPageProps<TItem, TValues extends Record<string, any>> = {
  title: string;
  columns: ColumnDef<TItem, any>[];
  fetcher: Fetcher<TItem>;
  queryKeyBase?: readonly unknown[];
  initialQuery?: string;
  initialPage?: number;
  initialPageSize?: number;
  autoloadOnMount?: boolean;
  onStateChange?: (state: CriteriaState) => void;
  createConfig?: CreateConfig<TValues>;
  editConfig?: EditConfig<TItem, TValues>;
  deleteConfig?: DeleteConfig<TItem>;
  getItemLabel?: (item: TItem) => string;
};

function renderFormFields<TValues extends Record<string, any>>({
  form,
  fields,
  values,
  disabled,
  firstFieldName,
}: {
  form: UseFormReturn<TValues>;
  fields: FormFieldConfig<TValues>[];
  values: TValues;
  disabled: boolean;
  firstFieldName?: string;
}) {
  return fields
    .filter((field) => (field.showIf ? field.showIf(values) : true))
    .map((field) => (
      <Controller
        key={field.name}
        name={field.name}
        control={form.control}
        render={({ field: controllerField, fieldState }) => {
          const isTextarea = field.type === 'textarea';
          const isSelect = field.type === 'select';
          const inputType = isTextarea || isSelect ? undefined : field.type ?? 'text';
          return (
            <TextField
              label={field.label}
              value={controllerField.value ?? ''}
              onChange={(event) => controllerField.onChange(event.target.value)}
              onBlur={controllerField.onBlur}
              name={controllerField.name}
              inputRef={controllerField.ref}
              fullWidth
              required={field.required}
              autoFocus={field.name === firstFieldName}
              error={Boolean(fieldState.error)}
              helperText={fieldState.error?.message ?? field.helperText}
              multiline={isTextarea}
              minRows={isTextarea ? 3 : undefined}
              type={inputType}
              disabled={disabled}
              select={isSelect}
            >
              {isSelect &&
                field.options?.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
            </TextField>
          );
        }}
      />
    ));
}

export default function ListPage<TItem extends { id?: string }, TValues extends Record<string, any> = Record<string, string>>({
  title,
  columns,
  fetcher,
  queryKeyBase,
  initialQuery = '',
  initialPage = 0,
  initialPageSize = 25,
  autoloadOnMount = false,
  onStateChange,
  createConfig,
  editConfig,
  deleteConfig,
  getItemLabel,
}: ListPageProps<TItem, TValues>) {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();
  const [criteria, setCriteria] = useState<CriteriaState>({ query: initialQuery, page: initialPage, pageSize: initialPageSize });
  const { query: searchValue, debouncedQuery, setQuery, commitQuery } = useSearch();
  const shouldFetchRef = useRef<boolean>(false);
  const [hasSearched, setHasSearched] = useState<boolean>(autoloadOnMount);
  const [createOpen, setCreateOpen] = useState(false);
  const [editDialog, setEditDialog] = useState<{ open: boolean; item: TItem | null }>({ open: false, item: null });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; item: TItem | null }>({ open: false, item: null });

  const createResolver = useMemo(
    () => (createConfig ? createZodResolver(createConfig.schema) : undefined),
    [createConfig?.schema],
  );
  const editResolver = useMemo(
    () => (editConfig ? createZodResolver(editConfig.schema) : undefined),
    [editConfig?.schema],
  );

  const createForm = useForm<TValues>({
    defaultValues: (createConfig?.defaultValues ?? {}) as TValues,
    resolver: createResolver,
  });

  const editForm = useForm<TValues>({
    defaultValues: (editConfig?.defaultValues ?? createConfig?.defaultValues ?? {}) as TValues,
    resolver: editResolver,
  });

  const createValues = createForm.watch();
  const editValues = editForm.watch();

  useEffect(() => {
    if (!createConfig) return;
    createForm.reset(createConfig.defaultValues);
    createForm.clearErrors();
  }, [createConfig?.defaultValues, createForm]);

  useEffect(() => {
    if (!editConfig) return;
    const defaults = editConfig.defaultValues ?? createConfig?.defaultValues ?? ({} as TValues);
    editForm.reset(defaults);
    editForm.clearErrors();
  }, [editConfig?.defaultValues, createConfig?.defaultValues, editForm]);

  const baseKey = useMemo(() => queryKeyBase ?? ['list', title.toLowerCase()], [queryKeyBase, title]);
  const queryKey = useMemo(
    () => [...baseKey, { q: criteria.query, page: criteria.page, pageSize: criteria.pageSize }],
    [baseKey, criteria.page, criteria.pageSize, criteria.query],
  );

  const { data, isFetching, isError, error, refetch } = useQuery({
    queryKey,
    queryFn: () => fetcher(criteria.query, criteria.page, criteria.pageSize),
    enabled: autoloadOnMount,
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    const next = { query: initialQuery, page: initialPage, pageSize: initialPageSize };
    commitQuery(next.query);
    setCriteria((prev) => {
      if (prev.query === next.query && prev.page === next.page && prev.pageSize === next.pageSize) {
        return prev;
      }
      if (!autoloadOnMount) {
        shouldFetchRef.current = true;
      }
      return next;
    });
  }, [initialQuery, initialPage, initialPageSize, commitQuery, autoloadOnMount]);

  useEffect(() => {
    onStateChange?.(criteria);
  }, [criteria, onStateChange]);

  useEffect(() => {
    if (!shouldFetchRef.current) return;
    shouldFetchRef.current = false;
    setHasSearched(true);
    void refetch();
  }, [criteria, refetch]);

  useEffect(() => {
    if (!autoloadOnMount) return;
    if (debouncedQuery === criteria.query) return;
    triggerFetch((prev) => ({ ...prev, query: debouncedQuery, page: 0 }));
  }, [autoloadOnMount, criteria.query, debouncedQuery]);

  const triggerFetch = useCallback(
    (updater: CriteriaState | ((prev: CriteriaState) => CriteriaState), options?: { force?: boolean }) => {
      const force = options?.force ?? false;
      setCriteria((prev) => {
        const next = typeof updater === 'function' ? (updater as (prev: CriteriaState) => CriteriaState)(prev) : updater;
        const unchanged = next.query === prev.query && next.page === prev.page && next.pageSize === prev.pageSize;
        if (unchanged && !force) {
          return prev;
        }
        if (!autoloadOnMount || force) {
          shouldFetchRef.current = true;
        }
        return unchanged ? { ...prev } : next;
      });
    },
    [autoloadOnMount],
  );

  const handleInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setQuery(event.target.value);
    },
    [setQuery],
  );

  const handleManualSearch = useCallback(() => {
    const nextQuery = commitQuery();
    const force = nextQuery === criteria.query;
    triggerFetch(
      (prev) => ({ ...prev, query: nextQuery, page: force ? prev.page : 0 }),
      { force },
    );
  }, [commitQuery, criteria.query, triggerFetch]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      handleManualSearch();
    },
    [handleManualSearch],
  );

  const handlePaginationChange = useCallback(
    (updater: PaginationState | ((prev: PaginationState) => PaginationState)) => {
      const current = { pageIndex: criteria.page, pageSize: criteria.pageSize };
      const next = typeof updater === 'function' ? (updater as (prev: PaginationState) => PaginationState)(current) : updater;
      triggerFetch((prev) => {
        const nextSize = next.pageSize;
        const nextPage = next.pageIndex;
        if (nextSize !== prev.pageSize) {
          return { ...prev, page: 0, pageSize: nextSize };
        }
        return { ...prev, page: nextPage };
      });
    },
    [criteria.page, criteria.pageSize, triggerFetch],
  );

  const paginationState = useMemo<PaginationState>(() => ({ pageIndex: criteria.page, pageSize: criteria.pageSize }), [criteria.page, criteria.pageSize]);

  const pagedData = data ?? { items: [] as TItem[], total: 0, page: criteria.page, pageSize: criteria.pageSize };
  const items = pagedData.items ?? [];
  const showSkeleton = isFetching && !data;
  const crudEnabled = Boolean(createConfig || editConfig || deleteConfig);

  const handleOpenCreate = useCallback(() => {
    if (!createConfig) return;
    createForm.reset(createConfig.defaultValues);
    createForm.clearErrors();
    setCreateOpen(true);
  }, [createConfig, createForm]);

  const handleEdit = useCallback(
    (item: TItem) => {
      if (!editConfig) return;
      const initialValues = editConfig.getInitialValues(item);
      editForm.reset(initialValues);
      editForm.clearErrors();
      setEditDialog({ open: true, item });
    },
    [editConfig, editForm],
  );

  const handleDelete = useCallback(
    (item: TItem) => {
      if (!deleteConfig) return;
      setDeleteDialog({ open: true, item });
    },
    [deleteConfig],
  );


  const resolveItemLabel = useCallback(
    (item: TItem | null) => {
      if (!item) return '';
      if (getItemLabel) return getItemLabel(item);
      const candidate =
        (typeof item === 'object' && item !== null &&
          ((item as Record<string, unknown>).name ??
            (item as Record<string, unknown>).title ??
            (item as Record<string, unknown>).slug)) ||
        item.id;
      return typeof candidate === 'string' ? candidate : candidate ? String(candidate) : '';
    },
    [getItemLabel],
  );

  const refreshList = useCallback(async () => {
    setHasSearched(true);
    shouldFetchRef.current = false;
    await queryClient.invalidateQueries({ queryKey: baseKey, exact: false });
  }, [baseKey, queryClient]);

  const createMutation = useMutation<void, unknown, { values: TValues; config: CreateConfig<TValues> }>({
    mutationFn: async ({ values, config }) => {
      await config.onSubmit(values);
    },
    onSuccess: async (_data, { config }) => {
      setCreateOpen(false);
      createForm.reset(config.defaultValues);
      createForm.clearErrors();
      enqueueSnackbar(config.successMessage ?? t('common:feedback.created'), { variant: 'success' });
      await refreshList();
    },
    onError: (err, { config }) => {
      console.error('Create mutation error', err);
      enqueueSnackbar(config.errorMessage ?? t('common:feedback.saveError'), { variant: 'error' });
    },
  });

  const editMutation = useMutation<void, unknown, { item: TItem; values: TValues; config: EditConfig<TItem, TValues> }>({
    mutationFn: async ({ item, values, config }) => {
      await config.onSubmit(item, values);
    },
    onSuccess: async (_data, { config }) => {
      setEditDialog({ open: false, item: null });
      const defaults = config.defaultValues ?? createConfig?.defaultValues ?? ({} as TValues);
      editForm.reset(defaults);
      editForm.clearErrors();
      enqueueSnackbar(config.successMessage ?? t('common:feedback.updated'), { variant: 'success' });
      await refreshList();
    },
    onError: (err, { config }) => {
      console.error('Edit mutation error', err);
      enqueueSnackbar(config.errorMessage ?? t('common:feedback.saveError'), { variant: 'error' });
    },
  });

  const deleteMutation = useMutation<void, unknown, { item: TItem; config: DeleteConfig<TItem> }>({
    mutationFn: async ({ item, config }) => {
      await config.mutation(item);
    },
    onSuccess: async (_data, { config }) => {
      setDeleteDialog({ open: false, item: null });
      enqueueSnackbar(config.successMessage ?? t('common:feedback.deleted'), { variant: 'success' });
      await refreshList();
    },
    onError: (err, { config }) => {
      console.error('Delete mutation error', err);
      enqueueSnackbar(config.errorMessage ?? t('common:feedback.saveError'), { variant: 'error' });
    },
  });

  const handleCloseCreate = useCallback(() => {
    if (!createConfig) return;
    if (createMutation.isPending) return;
    setCreateOpen(false);
    createForm.reset(createConfig.defaultValues);
    createForm.clearErrors();
  }, [createConfig?.defaultValues, createForm, createMutation.isPending]);

  const handleCreateSubmit = useCallback(() => {
    if (!createConfig) return;
    createForm.handleSubmit((values) => {
      createMutation.mutate({ values, config: createConfig });
    }, () => undefined)();
  }, [createConfig, createForm, createMutation]);

  const handleCloseEdit = useCallback(() => {
    if (!editConfig) return;
    if (editMutation.isPending) return;
    setEditDialog({ open: false, item: null });
    const defaults = editConfig.defaultValues ?? createConfig?.defaultValues ?? ({} as TValues);
    editForm.reset(defaults);
    editForm.clearErrors();
  }, [editConfig?.defaultValues, createConfig?.defaultValues, editForm, editMutation.isPending]);

  const handleEditSubmit = useCallback(() => {
    if (!editConfig || !editDialog.item) return;
    editForm.handleSubmit((values) => {
      editMutation.mutate({ item: editDialog.item as TItem, values, config: editConfig });
    }, () => undefined)();
  }, [editConfig, editDialog.item, editForm, editMutation]);

  const handleCloseDelete = useCallback(() => {
    if (deleteMutation.isPending) return;
    setDeleteDialog({ open: false, item: null });
  }, [deleteMutation.isPending]);

  const handleConfirmDelete = useCallback(() => {
    if (!deleteConfig || !deleteDialog.item) return;
    deleteMutation.mutate({ item: deleteDialog.item, config: deleteConfig });
  }, [deleteConfig, deleteDialog.item, deleteMutation]);

  const actionColumn = useMemo<ColumnDef<TItem, any> | null>(() => {
    if (!crudEnabled) return null;
    return {
      id: '__actions',
      header: () => <Box textAlign="right">{t('common:actions.actions')}</Box>,
      cell: ({ row }) => (
        <Box textAlign="right">
          <RowActionsMenu
            onEdit={editConfig ? () => handleEdit(row.original) : undefined}
            onDelete={deleteConfig ? () => handleDelete(row.original) : undefined}
          />
        </Box>
      ),
      enableSorting: false,
    };
  }, [crudEnabled, deleteConfig, editConfig, handleDelete, handleEdit, t]);

  const columnsWithActions = useMemo(() => {
    if (!actionColumn) return columns;
    return [...columns, actionColumn];
  }, [actionColumn, columns]);

  const createVisibleFields = useMemo(() => {
    if (!createConfig) return [] as FormFieldConfig<TValues>[];
    return createConfig.fields.filter((field) => (field.showIf ? field.showIf(createValues) : true));
  }, [createConfig?.fields, createValues]);

  const editVisibleFields = useMemo(() => {
    if (!editConfig) return [] as FormFieldConfig<TValues>[];
    return editConfig.fields.filter((field) => (field.showIf ? field.showIf(editValues) : true));
  }, [editConfig?.fields, editValues]);

  const createFirstField = createVisibleFields[0]?.name;
  const editFirstField = editVisibleFields[0]?.name;

  const deleteDescription = deleteDialog.item
    ? deleteConfig?.description?.(deleteDialog.item) ?? t('common:feedback.deleteConfirm', { name: resolveItemLabel(deleteDialog.item) })
    : '';

  const deleteTitle = deleteConfig?.dialogTitle ?? t('common:actions.delete');
  const deleteConfirmLabel = deleteConfig?.confirmLabel ?? t('common:actions.delete');

  const isCreating = createMutation.isPending;
  const isEditing = editMutation.isPending;
  const isDeleting = deleteMutation.isPending;

  return (
    <Paper
      sx={(theme) => ({
        padding: theme.layout.cardPadding,
        boxShadow: theme.customShadows.card,
        backgroundColor: theme.palette.background.paper,
      })}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        sx={(theme) => ({ mb: theme.spacing(4) })}
      >
        <Typography variant="h6">{title}</Typography>
        <Box sx={{ flexGrow: 1 }} />
        {createConfig && (
          <Button variant="contained" onClick={handleOpenCreate} disabled={isCreating}>
            {createConfig.triggerLabel ?? t('common:actions.add')}
          </Button>
        )}
        <TextField
          size="small"
          placeholder={t('common:search.placeholder')}
          value={searchValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
        />
      </Stack>
      {isError && !isFetching && (
        <Alert severity="error" sx={(theme) => ({ mb: theme.spacing(3) })}>
          {error instanceof Error ? error.message : t('common:feedback.loadError')}
        </Alert>
      )}
      <DataTable<TItem>
        data={items}
        columns={columnsWithActions}
        selectable={false}
        loading={showSkeleton}
        pagination={paginationState}
        onPaginationChange={handlePaginationChange}
      />
      {!autoloadOnMount && !hasSearched && !isFetching && (
        <Typography variant="caption" color="text.secondary" sx={(theme) => ({ display: 'block', mt: theme.spacing(2) })}>
          {t('common:search.pressEnter')}
        </Typography>
      )}
      {createConfig && (
        <Dialog open={createOpen} onClose={handleCloseCreate} fullWidth maxWidth="sm">
          <DialogTitle>{createConfig.dialogTitle}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              {renderFormFields({
                form: createForm,
                fields: createConfig.fields,
                values: createValues,
                disabled: isCreating,
                firstFieldName: createFirstField,
              })}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseCreate} disabled={isCreating}>
              {t('common:actions.cancel')}
            </Button>
            <Button variant="contained" onClick={handleCreateSubmit} disabled={isCreating}>
              {createConfig.submitLabel ?? t('common:actions.save')}
            </Button>
          </DialogActions>
        </Dialog>
      )}
      {editConfig && (
        <Dialog open={editDialog.open} onClose={handleCloseEdit} fullWidth maxWidth="sm">
          <DialogTitle>{editConfig.dialogTitle}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              {renderFormFields({
                form: editForm,
                fields: editConfig.fields,
                values: editValues,
                disabled: isEditing,
                firstFieldName: editFirstField,
              })}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseEdit} disabled={isEditing}>
              {t('common:actions.cancel')}
            </Button>
            <Button variant="contained" onClick={handleEditSubmit} disabled={isEditing}>
              {editConfig.submitLabel ?? t('common:actions.saveChanges')}
            </Button>
          </DialogActions>
        </Dialog>
      )}
      {deleteConfig && (
        <Dialog open={deleteDialog.open} onClose={handleCloseDelete} fullWidth maxWidth="xs">
          <DialogTitle>{deleteTitle}</DialogTitle>
          <DialogContent>
            <Typography>{deleteDescription}</Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDelete} disabled={isDeleting}>
              {t('common:actions.cancel')}
            </Button>
            <Button color="error" variant="contained" onClick={handleConfirmDelete} disabled={isDeleting}>
              {isDeleting ? t('common:actions.deleteInProgress') : deleteConfirmLabel}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Paper>
  );
}

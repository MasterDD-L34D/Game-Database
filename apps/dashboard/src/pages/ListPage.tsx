import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { ColumnDef, type PaginationState } from '@tanstack/react-table';
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import DataTable from '../components/data-table/DataTable';
import RowActionsMenu from '../components/data-table/RowActionsMenu';
import { useSnackbar } from '../components/SnackbarProvider';
import { useSearch } from '../providers/SearchProvider';

type Fetcher<T> = (q: string, page?: number, pageSize?: number) => Promise<{ items: T[]; page: number; pageSize: number; total: number }>;

type CriteriaState = { query: string; page: number; pageSize: number };

type FormFieldConfig = {
  name: string;
  label: string;
  required?: boolean;
  multiline?: boolean;
  type?: 'text' | 'number' | 'textarea';
};

type CreateConfig = {
  triggerLabel?: string;
  dialogTitle: string;
  submitLabel?: string;
  defaultValues?: Record<string, string>;
  fields: FormFieldConfig[];
  mutation: (values: Record<string, string>) => Promise<unknown>;
  successMessage?: string;
  errorMessage?: string;
};

type EditConfig<T> = {
  dialogTitle: string;
  submitLabel?: string;
  fields: FormFieldConfig[];
  getInitialValues: (item: T) => Record<string, string>;
  mutation: (item: T, values: Record<string, string>) => Promise<unknown>;
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

type ListPageProps<T> = {
  title: string;
  columns: ColumnDef<T, any>[];
  fetcher: Fetcher<T>;
  queryKeyBase?: readonly unknown[];
  initialQuery?: string;
  initialPage?: number;
  initialPageSize?: number;
  autoloadOnMount?: boolean;
  onStateChange?: (state: CriteriaState) => void;
  createConfig?: CreateConfig;
  editConfig?: EditConfig<T>;
  deleteConfig?: DeleteConfig<T>;
  getItemLabel?: (item: T) => string;
};

export default function ListPage<T extends { id?: string }>({
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
}: ListPageProps<T>) {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [criteria, setCriteria] = useState<CriteriaState>({ query: initialQuery, page: initialPage, pageSize: initialPageSize });
  const { query: searchValue, debouncedQuery, setQuery, commitQuery } = useSearch();
  const shouldFetchRef = useRef<boolean>(false);
  const [hasSearched, setHasSearched] = useState<boolean>(autoloadOnMount);
  const [createOpen, setCreateOpen] = useState(false);
  const [createValues, setCreateValues] = useState<Record<string, string>>(createConfig?.defaultValues ?? {});
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});
  const [editDialog, setEditDialog] = useState<{ open: boolean; item: T | null; values: Record<string, string> }>({ open: false, item: null, values: {} });
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; item: T | null }>({ open: false, item: null });

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
  }, [autoloadOnMount, criteria.query, debouncedQuery, triggerFetch]);

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

  const handleInputChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
  }, [setQuery]);

  const handleManualSearch = useCallback(() => {
    const nextQuery = commitQuery();
    const force = nextQuery === criteria.query;
    triggerFetch(
      (prev) => ({ ...prev, query: nextQuery, page: force ? prev.page : 0 }),
      { force },
    );
  }, [commitQuery, criteria.query, triggerFetch]);

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    handleManualSearch();
  }, [handleManualSearch]);

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

  const pagedData = data ?? { items: [] as T[], total: 0, page: criteria.page, pageSize: criteria.pageSize };
  const items = pagedData.items ?? [];
  const showSkeleton = isFetching && !data;
  const crudEnabled = Boolean(createConfig || editConfig || deleteConfig);

  const validateForm = useCallback(
    (fields: FormFieldConfig[], values: Record<string, string>) => {
      const errors: Record<string, string> = {};
      fields.forEach((field) => {
        if (field.required) {
          const value = values[field.name];
          if (!value || value.trim() === '') {
            errors[field.name] = t('common:validation.required');
          }
        }
      });
      return errors;
    },
    [t],
  );

  useEffect(() => {
    setCreateValues(createConfig?.defaultValues ?? {});
  }, [createConfig]);

  const handleOpenCreate = useCallback(() => {
    if (!createConfig) return;
    setCreateValues(createConfig.defaultValues ?? {});
    setCreateErrors({});
    setCreateOpen(true);
  }, [createConfig]);

  const handleCloseCreate = useCallback(() => {
    if (createMutation.isPending) return;
    setCreateOpen(false);
  }, [createMutation.isPending]);

  const handleCreateValueChange = useCallback((name: string, value: string) => {
    setCreateValues((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleCreateSubmit = useCallback(() => {
    if (!createConfig) return;
    const errors = validateForm(createConfig.fields, createValues);
    if (Object.keys(errors).length > 0) {
      setCreateErrors(errors);
      return;
    }
    setCreateErrors({});
    createMutation.mutate({ values: createValues, config: createConfig });
  }, [createConfig, createMutation, createValues, validateForm]);

  const handleEdit = useCallback((item: T) => {
    if (!editConfig) return;
    setEditDialog({ open: true, item, values: editConfig.getInitialValues(item) });
    setEditErrors({});
  }, [editConfig]);

  const handleCloseEdit = useCallback(() => {
    if (editMutation.isPending) return;
    setEditDialog({ open: false, item: null, values: {} });
  }, [editMutation.isPending]);

  const handleEditValueChange = useCallback((name: string, value: string) => {
    setEditDialog((prev) => ({ ...prev, values: { ...prev.values, [name]: value } }));
  }, []);

  const handleEditSubmit = useCallback(() => {
    if (!editConfig || !editDialog.item) return;
    const errors = validateForm(editConfig.fields, editDialog.values);
    if (Object.keys(errors).length > 0) {
      setEditErrors(errors);
      return;
    }
    setEditErrors({});
    editMutation.mutate({ item: editDialog.item, values: editDialog.values, config: editConfig });
  }, [editConfig, editDialog, editMutation, validateForm]);

  const handleDelete = useCallback((item: T) => {
    if (!deleteConfig) return;
    setDeleteDialog({ open: true, item });
  }, [deleteConfig]);

  const handleCloseDelete = useCallback(() => {
    if (deleteMutation.isPending) return;
    setDeleteDialog({ open: false, item: null });
  }, [deleteMutation.isPending]);

  const handleConfirmDelete = useCallback(() => {
    if (!deleteConfig || !deleteDialog.item) return;
    deleteMutation.mutate({ item: deleteDialog.item, config: deleteConfig });
  }, [deleteConfig, deleteDialog.item, deleteMutation]);

  const resolveItemLabel = useCallback(
    (item: T | null) => {
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
    await refetch();
  }, [refetch]);

  const createMutation = useMutation<void, unknown, { values: Record<string, string>; config?: CreateConfig }>({
    mutationFn: async ({ values, config }) => {
      if (!config) throw new Error('Create non configurato');
      await config.mutation(values);
    },
    onSuccess: async (_data, { config }) => {
      setCreateOpen(false);
      setCreateValues(config?.defaultValues ?? {});
      enqueueSnackbar(config?.successMessage ?? t('common:feedback.created'), { variant: 'success' });
      await refreshList();
    },
    onError: (err, { config }) => {
      console.error('Create mutation error', err);
      enqueueSnackbar(config?.errorMessage ?? t('common:feedback.saveError'), { variant: 'error' });
    },
  });

  const editMutation = useMutation<void, unknown, { item: T; values: Record<string, string>; config?: EditConfig<T> }>({
    mutationFn: async ({ item, values, config }) => {
      if (!config) throw new Error('Edit non configurato');
      await config.mutation(item, values);
    },
    onSuccess: async (_data, { config }) => {
      setEditDialog({ open: false, item: null, values: {} });
      enqueueSnackbar(config?.successMessage ?? t('common:feedback.updated'), { variant: 'success' });
      await refreshList();
    },
    onError: (err, { config }) => {
      console.error('Edit mutation error', err);
      enqueueSnackbar(config?.errorMessage ?? t('common:feedback.saveError'), { variant: 'error' });
    },
  });

  const deleteMutation = useMutation<void, unknown, { item: T; config?: DeleteConfig<T> }>({
    mutationFn: async ({ item, config }) => {
      if (!config) throw new Error('Delete non configurato');
      await config.mutation(item);
    },
    onSuccess: async (_data, { config }) => {
      setDeleteDialog({ open: false, item: null });
      enqueueSnackbar(config?.successMessage ?? t('common:feedback.deleted'), { variant: 'success' });
      await refreshList();
    },
    onError: (err, { config }) => {
      console.error('Delete mutation error', err);
      enqueueSnackbar(config?.errorMessage ?? t('common:feedback.saveError'), { variant: 'error' });
    },
  });

  const actionColumn = useMemo<ColumnDef<T, any> | null>(() => {
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

  const createFirstField = createConfig?.fields[0]?.name;
  const editFirstField = editConfig?.fields[0]?.name;

  const deleteDescription = deleteDialog.item
    ? deleteConfig?.description?.(deleteDialog.item) ?? t('common:feedback.deleteConfirm', { name: resolveItemLabel(deleteDialog.item) })
    : '';

  const deleteTitle = deleteConfig?.dialogTitle ?? t('common:actions.delete');
  const deleteConfirmLabel = deleteConfig?.confirmLabel ?? t('common:actions.delete');

  const isCreating = createMutation.isPending;
  const isEditing = editMutation.isPending;
  const isDeleting = deleteMutation.isPending;

  return (
    <Paper className="p-4">
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }} className="mb-4">
        <Typography variant="h6">{title}</Typography>
        <div className="flex-1" />
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
        <Alert severity="error" className="mb-3">
          {error instanceof Error ? error.message : t('common:feedback.loadError')}
        </Alert>
      )}
      <DataTable<T>
        data={items}
        columns={columnsWithActions}
        selectable={false}
        loading={showSkeleton}
        pagination={paginationState}
        onPaginationChange={handlePaginationChange}
      />
      {!autoloadOnMount && !hasSearched && !isFetching && (
        <div className="text-sm text-gray-500 mt-2">{t('common:search.pressEnter')}</div>
      )}
      {createConfig && (
        <Dialog open={createOpen} onClose={handleCloseCreate} fullWidth maxWidth="sm">
          <DialogTitle>{createConfig.dialogTitle}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              {createConfig.fields.map((field) => {
                const value = createValues[field.name] ?? '';
                const errorMessage = createErrors[field.name];
                const isTextarea = field.type === 'textarea' || field.multiline;
                return (
                  <TextField
                    key={field.name}
                    name={field.name}
                    label={field.label}
                    value={value}
                    onChange={(event) => handleCreateValueChange(field.name, event.target.value)}
                    fullWidth
                    required={field.required}
                    autoFocus={field.name === createFirstField}
                    error={Boolean(errorMessage)}
                    helperText={errorMessage}
                    multiline={isTextarea}
                    minRows={isTextarea ? 3 : undefined}
                    type={isTextarea ? undefined : field.type ?? 'text'}
                    disabled={isCreating}
                  />
                );
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
              {editConfig.fields.map((field) => {
                const value = editDialog.values[field.name] ?? '';
                const errorMessage = editErrors[field.name];
                const isTextarea = field.type === 'textarea' || field.multiline;
                return (
                  <TextField
                    key={field.name}
                    name={field.name}
                    label={field.label}
                    value={value}
                    onChange={(event) => handleEditValueChange(field.name, event.target.value)}
                    fullWidth
                    required={field.required}
                    autoFocus={field.name === editFirstField}
                    error={Boolean(errorMessage)}
                    helperText={errorMessage}
                    multiline={isTextarea}
                    minRows={isTextarea ? 3 : undefined}
                    type={isTextarea ? undefined : field.type ?? 'text'}
                    disabled={isEditing}
                  />
                );
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

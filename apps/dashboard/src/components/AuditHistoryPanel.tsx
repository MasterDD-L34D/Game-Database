import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { listAudit, revertAudit, type AuditAction, type AuditEntry, type AuditPage } from '../lib/audit';
import { useSnackbar } from './SnackbarProvider';
import AuditPayloadRenderer from './AuditPayloadRenderer';

const PAGE_SIZE = 10;

function chipColorForAction(action: AuditAction): 'success' | 'info' | 'error' {
  switch (action) {
    case 'CREATE':
      return 'success';
    case 'UPDATE':
      return 'info';
    case 'DELETE':
      return 'error';
    default:
      return 'info';
  }
}

function formatTimestamp(iso: string): string {
  try {
    const date = new Date(iso);
    return new Intl.DateTimeFormat('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(date);
  } catch {
    return iso;
  }
}

interface AuditEntryRowProps {
  entry: AuditEntry;
  previousPayload?: unknown;
  onRevert?: (logId: string) => void;
  isReverting?: boolean;
}

function AuditEntryRow({ entry, previousPayload, onRevert, isReverting }: AuditEntryRowProps) {
  const { t } = useTranslation('audit');
  const [expanded, setExpanded] = useState(false);
  const formatted = formatTimestamp(entry.createdAt);
  const userLabel = entry.user || t('anonymousUser');
  const hasPayload = entry.payload !== null && entry.payload !== undefined;
  const canRevert = entry.action === 'DELETE' && Boolean(onRevert);

  return (
    <Box
      role="listitem"
      aria-label={t('aria.entry', { action: t(`actions.${entry.action}`), date: formatted })}
      sx={{ py: 1.5 }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
        <Chip
          size="small"
          color={chipColorForAction(entry.action)}
          label={t(`actions.${entry.action}`)}
        />
        <Typography variant="body2" color="text.primary">
          {formatted}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          · {userLabel}
        </Typography>
        {hasPayload ? (
          <IconButton
            size="small"
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? t('togglePayloadHide') : t('togglePayload')}
          >
            <Typography variant="caption" component="span" sx={{ fontFamily: 'monospace' }}>
              {expanded ? '▾' : '▸'}
            </Typography>
          </IconButton>
        ) : null}
        {canRevert ? (
          <Button
            size="small"
            variant="outlined"
            color="primary"
            disabled={isReverting}
            onClick={() => onRevert?.(entry.id)}
            aria-label={t('aria.revertButton', { entity: entry.entity, entityId: entry.entityId })}
          >
            {isReverting ? t('revert.inProgress') : t('revert.button')}
          </Button>
        ) : null}
      </Stack>
      {hasPayload ? (
        <Collapse in={expanded} unmountOnExit>
          <AuditPayloadRenderer
            action={entry.action}
            payload={entry.payload}
            previousPayload={previousPayload}
          />
        </Collapse>
      ) : null}
    </Box>
  );
}

export interface AuditHistoryPanelProps {
  entity: string;
  entityId: string;
}

const FILTER_DEBOUNCE_MS = 300;

export default function AuditHistoryPanel({ entity, entityId }: AuditHistoryPanelProps) {
  const { t } = useTranslation('audit');
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();

  // Filter state (Fase 2 8/N): action select + user text (debounced).
  // Backend params already supported by PR #122 GET /api/audit.
  const [actionFilter, setActionFilter] = useState<AuditAction | ''>('');
  const [userFilterInput, setUserFilterInput] = useState('');
  const [userFilter, setUserFilter] = useState('');

  useEffect(() => {
    const handle = setTimeout(() => {
      setUserFilter(userFilterInput.trim());
    }, FILTER_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [userFilterInput]);

  // Codex P2 fix from PR #127 review: previous `useQuery` + `page` state
  // replaced visible items on `Carica altri` because the panel only
  // rendered the current page's items. `useInfiniteQuery` accumulates
  // pages across "load more" clicks while keeping pagination + total
  // wiring intact.
  const query = useInfiniteQuery<AuditPage>({
    queryKey: ['audit', entity, entityId, actionFilter, userFilter],
    queryFn: ({ pageParam = 0 }) =>
      listAudit({
        entity,
        entityId,
        action: actionFilter || undefined,
        user: userFilter || undefined,
        page: pageParam as number,
        pageSize: PAGE_SIZE,
      }),
    enabled: Boolean(entity && entityId),
    getNextPageParam: (lastPage) => {
      const loadedSoFar = (lastPage.page + 1) * lastPage.pageSize;
      return loadedSoFar < lastPage.total ? lastPage.page + 1 : undefined;
    },
    initialPageParam: 0,
  });

  const handleClearFilters = () => {
    setActionFilter('');
    setUserFilterInput('');
    setUserFilter('');
  };

  const hasActiveFilters = Boolean(actionFilter || userFilter);

  const items = useMemo<AuditEntry[]>(
    () => (query.data?.pages ?? []).flatMap((p) => p.items),
    [query.data],
  );
  const total = query.data?.pages?.[0]?.total ?? 0;
  const hasMore = Boolean(query.hasNextPage);

  // Confirmation dialog state (Fase 2 4/N): block accidental revert clicks
  // by requiring explicit confirm. Stores the entry pending confirmation
  // (or null when closed).
  const [pendingRevert, setPendingRevert] = useState<AuditEntry | null>(null);

  const revertMutation = useMutation({
    mutationFn: (logId: string) => revertAudit(logId),
    onSuccess: (data) => {
      enqueueSnackbar(t('revert.successToast', { entity: data.entity }), { variant: 'success' });
      // Refresh audit panel + invalidate parent entity caches so detail page
      // re-fetches the resurrected entity.
      queryClient.invalidateQueries({ queryKey: ['audit', entity, entityId] });
      const entityKey = entity.toLowerCase();
      queryClient.invalidateQueries({ queryKey: [entityKey] });
      setPendingRevert(null);
    },
    onError: (error: unknown) => {
      // Inspect error message for known backend codes (409 CONFLICT, 400
      // NOT_REVERTABLE) and surface localized toast.
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('409')) {
        enqueueSnackbar(t('revert.errorConflict'), { variant: 'error' });
      } else if (msg.includes('400')) {
        enqueueSnackbar(t('revert.errorNotRevertable'), { variant: 'error' });
      } else {
        enqueueSnackbar(t('revert.errorGeneric'), { variant: 'error' });
      }
      setPendingRevert(null);
    },
  });

  const handleRevert = (logId: string) => {
    const entry = items.find((e) => e.id === logId);
    if (!entry) return;
    setPendingRevert(entry);
  };

  const confirmRevert = () => {
    if (pendingRevert) {
      revertMutation.mutate(pendingRevert.id);
    }
  };

  const cancelRevert = () => {
    if (!revertMutation.isPending) {
      setPendingRevert(null);
    }
  };

  return (
    <Card variant="outlined" aria-label={t('aria.panel')}>
      <CardContent>
        <Stack spacing={0.5} mb={2}>
          <Typography variant="h6">{t('title')}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t('subtitle')}
          </Typography>
        </Stack>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} mb={2} alignItems={{ xs: 'stretch', sm: 'center' }}>
          <TextField
            select
            size="small"
            label={t('aria.filterAction')}
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value as AuditAction | '')}
            sx={{ minWidth: 160 }}
            inputProps={{ 'aria-label': t('aria.filterAction') }}
          >
            <MenuItem value="">{t('filter.actionAll')}</MenuItem>
            <MenuItem value="CREATE">{t('actions.CREATE')}</MenuItem>
            <MenuItem value="UPDATE">{t('actions.UPDATE')}</MenuItem>
            <MenuItem value="DELETE">{t('actions.DELETE')}</MenuItem>
          </TextField>
          <TextField
            size="small"
            placeholder={t('filter.userPlaceholder')}
            value={userFilterInput}
            onChange={(e) => setUserFilterInput(e.target.value)}
            sx={{ minWidth: 220, flex: 1 }}
            inputProps={{ 'aria-label': t('aria.filterUser') }}
          />
          {hasActiveFilters ? (
            <Button
              size="small"
              variant="text"
              onClick={handleClearFilters}
              aria-label={t('aria.filterClear')}
            >
              {t('filter.clear')}
            </Button>
          ) : null}
        </Stack>

        {query.isError ? (
          <Alert severity="error">{t('loadError')}</Alert>
        ) : null}

        {query.isLoading ? (
          <Typography color="text.secondary">{t('loading')}</Typography>
        ) : null}

        {!query.isLoading && items.length === 0 && !query.isError ? (
          <Typography color="text.secondary">{t('empty')}</Typography>
        ) : null}

        {items.length > 0 ? (
          <Box role="list">
            {items.map((entry, idx) => {
              // Items are sorted createdAt DESC → the next index is the
              // CHRONOLOGICALLY PRIOR entry for the same entity. Pass its
              // payload as `previousPayload` so AuditPayloadRenderer can
              // diff UPDATE patches against the prior state. Skipped when
              // there's no preceding entry (last item) or when prior is
              // a DELETE (an entity cannot UPDATE after being deleted in
              // normal flow; defensive guard).
              const candidate = items[idx + 1];
              const previousPayload =
                candidate && candidate.entityId === entry.entityId && candidate.action !== 'DELETE'
                  ? candidate.payload
                  : undefined;
              return (
                <Box key={entry.id}>
                  <AuditEntryRow
                    entry={entry}
                    previousPayload={previousPayload}
                    onRevert={handleRevert}
                    isReverting={
                      revertMutation.isPending && revertMutation.variables === entry.id
                    }
                  />
                  {idx < items.length - 1 ? <Divider /> : null}
                </Box>
              );
            })}
          </Box>
        ) : null}

        {total > 0 ? (
          <Stack direction="row" justifyContent="space-between" alignItems="center" mt={2}>
            <Typography variant="caption" color="text.secondary">
              {t('totalCount', { count: total })}
            </Typography>
            {hasMore ? (
              <Button
                size="small"
                onClick={() => {
                  void query.fetchNextPage();
                }}
                disabled={query.isFetching || query.isFetchingNextPage}
              >
                {t('loadMore')}
              </Button>
            ) : null}
          </Stack>
        ) : null}
      </CardContent>

      <Dialog
        open={pendingRevert !== null}
        onClose={cancelRevert}
        aria-labelledby="audit-revert-dialog-title"
        aria-describedby="audit-revert-dialog-body"
      >
        <DialogTitle id="audit-revert-dialog-title">{t('revert.confirmTitle')}</DialogTitle>
        <DialogContent>
          <DialogContentText id="audit-revert-dialog-body">
            {pendingRevert
              ? t('revert.confirmBody', {
                  entity: pendingRevert.entity,
                  entityId: pendingRevert.entityId,
                })
              : null}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={cancelRevert} disabled={revertMutation.isPending}>
            {t('revert.confirmCancel')}
          </Button>
          <Button
            onClick={confirmRevert}
            variant="contained"
            color="primary"
            disabled={revertMutation.isPending}
            autoFocus
          >
            {revertMutation.isPending ? t('revert.inProgress') : t('revert.confirmAction')}
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}

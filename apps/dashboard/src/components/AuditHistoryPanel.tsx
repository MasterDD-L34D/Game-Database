import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
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
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { buildAuditCsvUrl, listAudit, revertAudit, type AuditAction, type AuditEntry, type AuditPage } from '../lib/audit';
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
  selectable?: boolean;
  selected?: boolean;
  onToggleSelected?: (logId: string, next: boolean) => void;
}

function AuditEntryRow({
  entry,
  previousPayload,
  onRevert,
  isReverting,
  selectable,
  selected,
  onToggleSelected,
}: AuditEntryRowProps) {
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
        {selectable && entry.action === 'DELETE' ? (
          <Checkbox
            size="small"
            checked={Boolean(selected)}
            onChange={(e) => onToggleSelected?.(entry.id, e.target.checked)}
            inputProps={{
              'aria-label': t('revert.bulkAriaSelectRow', {
                entity: entry.entity,
                entityId: entry.entityId,
              }),
            }}
            sx={{ p: 0.5 }}
          />
        ) : null}
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
  // Fase 2 9/N: + since/until date range (datetime-local, no debounce —
  // explicit user-picked date doesn't churn on keystroke).
  // Fase 2 12/N: + URL sync via namespaced ?audit_action / ?audit_user /
  // ?audit_since / ?audit_until params so filtered views are
  // deep-linkable. Namespace prefix avoids collision with parent list
  // page params (q/page/pageSize/sort).
  // Backend params supported by PR #122/#136/#137 GET /api/audit.
  const [searchParams, setSearchParams] = useSearchParams();
  const ALLOWED_ACTIONS: ReadonlyArray<AuditAction> = ['CREATE', 'UPDATE', 'DELETE'];
  const initialActionParam = searchParams.get('audit_action') ?? '';
  const initialAction: AuditAction | '' =
    ALLOWED_ACTIONS.includes(initialActionParam as AuditAction) ? (initialActionParam as AuditAction) : '';
  const initialUser = searchParams.get('audit_user') ?? '';
  const initialSince = searchParams.get('audit_since') ?? '';
  const initialUntil = searchParams.get('audit_until') ?? '';
  const [actionFilter, setActionFilter] = useState<AuditAction | ''>(initialAction);
  const [userFilterInput, setUserFilterInput] = useState(initialUser);
  const [userFilter, setUserFilter] = useState(initialUser);
  const [sinceFilter, setSinceFilter] = useState(initialSince);
  const [untilFilter, setUntilFilter] = useState(initialUntil);

  // Sync filter state → URL whenever any debounced/committed filter changes
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    const ensure = (key: string, value: string) => {
      if (value) next.set(key, value);
      else next.delete(key);
    };
    ensure('audit_action', actionFilter);
    ensure('audit_user', userFilter);
    ensure('audit_since', sinceFilter);
    ensure('audit_until', untilFilter);
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
    // searchParams intentionally excluded from deps: we only push on
    // filter changes, not on every URL navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionFilter, userFilter, sinceFilter, untilFilter]);

  useEffect(() => {
    const handle = setTimeout(() => {
      setUserFilter(userFilterInput.trim());
    }, FILTER_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [userFilterInput]);

  // datetime-local emits "YYYY-MM-DDTHH:mm" (no seconds, no timezone).
  // Codex P1 fix from PR #137 review: parsing such strings with new Date()
  // on the server applies the SERVER's local tz, which may differ from the
  // BROWSER's tz → boundary rows leak/miss by that offset. Fix: client
  // converts to absolute UTC ISO via the browser's local-tz Date() before
  // sending, so the wire contract is unambiguous.
  function toUtcIso(localDateTime: string): string {
    // Empty input → empty (caller treats as undefined)
    if (!localDateTime) return '';
    const parsed = new Date(localDateTime);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toISOString();
  }
  const sinceIso = toUtcIso(sinceFilter);
  const untilIso = toUtcIso(untilFilter);

  // Format a Date as the datetime-local input shape "YYYY-MM-DDTHH:mm"
  // in the BROWSER's local timezone. Used by the preset buttons below to
  // populate the since/until TextField values so users see what they
  // would have typed manually.
  function toLocalDateTimeInput(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return (
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
      `T${pad(d.getHours())}:${pad(d.getMinutes())}`
    );
  }

  const applyPreset = (hours: number) => {
    const now = new Date();
    const since = new Date(now.getTime() - hours * 60 * 60 * 1000);
    setSinceFilter(toLocalDateTimeInput(since));
    setUntilFilter(toLocalDateTimeInput(now));
  };

  const applyCustomPreset = () => {
    // "Personalizzato" simply clears both — user types manually after
    setSinceFilter('');
    setUntilFilter('');
  };

  // Codex P2 fix from PR #127 review: previous `useQuery` + `page` state
  // replaced visible items on `Carica altri` because the panel only
  // rendered the current page's items. `useInfiniteQuery` accumulates
  // pages across "load more" clicks while keeping pagination + total
  // wiring intact.
  const query = useInfiniteQuery<AuditPage>({
    queryKey: ['audit', entity, entityId, actionFilter, userFilter, sinceIso, untilIso],
    queryFn: ({ pageParam = 0 }) =>
      listAudit({
        entity,
        entityId,
        action: actionFilter || undefined,
        user: userFilter || undefined,
        since: sinceIso || undefined,
        until: untilIso || undefined,
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
    setSinceFilter('');
    setUntilFilter('');
  };

  const hasActiveFilters = Boolean(actionFilter || userFilter || sinceFilter || untilFilter);

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

  // Bulk revert state (Fase 2 13/N): set of selected DELETE-entry ids
  // + pending-bulk-confirm flag. Bulk-mode only highlights DELETE rows
  // since v1 server endpoint restricts revert to DELETE actions.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pendingBulkConfirm, setPendingBulkConfirm] = useState(false);
  const [bulkInProgress, setBulkInProgress] = useState(false);

  const toggleSelected = (logId: string, next: boolean) => {
    setSelectedIds((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(logId);
      else copy.delete(logId);
      return copy;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  // Codex P2 fix from PR #141 review: reset bulk selection whenever the
  // filter context changes (action/user/since/until) so the user can't
  // accidentally revert hidden/stale rows that are no longer visible.
  useEffect(() => {
    clearSelection();
    // intentional dep set — only filter knobs trigger reset
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionFilter, userFilter, sinceFilter, untilFilter]);

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

  const confirmBulkRevert = async () => {
    // Codex P2 fix from PR #141 review: intersect selectedIds with the
    // currently visible items + restrict to action='DELETE' before sending.
    // Defensive layer against stale selections that could leak after a
    // race (refetch arrived after click). Combined with the filter-change
    // reset above, eliminates the "revert hidden/stale items" bug.
    const visibleDeleteIds = new Set(
      items.filter((e) => e.action === 'DELETE').map((e) => e.id),
    );
    const ids = Array.from(selectedIds).filter((id) => visibleDeleteIds.has(id));
    if (ids.length === 0) {
      setPendingBulkConfirm(false);
      clearSelection();
      return;
    }
    setBulkInProgress(true);
    try {
      const results = await Promise.allSettled(ids.map((id) => revertAudit(id)));
      const successCount = results.filter((r) => r.status === 'fulfilled').length;
      const failedCount = results.length - successCount;
      if (failedCount === 0) {
        enqueueSnackbar(t('revert.bulkSuccessAllToast', { count: successCount }), {
          variant: 'success',
        });
      } else {
        enqueueSnackbar(
          t('revert.bulkSuccessToast', { success: successCount, failed: failedCount }),
          { variant: 'warning' },
        );
      }
      // Refresh audit panel + parent entity caches
      queryClient.invalidateQueries({ queryKey: ['audit', entity, entityId] });
      const entityKey = entity.toLowerCase();
      queryClient.invalidateQueries({ queryKey: [entityKey] });
    } finally {
      setBulkInProgress(false);
      setPendingBulkConfirm(false);
      clearSelection();
    }
  };

  return (
    <Card variant="outlined" aria-label={t('aria.panel')}>
      <CardContent>
        <Stack direction="row" spacing={1} mb={2} alignItems="flex-start" justifyContent="space-between" flexWrap="wrap">
          <Stack spacing={0.5}>
            <Typography variant="h6">{t('title')}</Typography>
            <Typography variant="body2" color="text.secondary">
              {t('subtitle')}
            </Typography>
          </Stack>
          <Button
            size="small"
            variant="outlined"
            component="a"
            href={buildAuditCsvUrl({
              entity,
              entityId,
              action: actionFilter || undefined,
              user: userFilter || undefined,
              since: sinceIso || undefined,
              until: untilIso || undefined,
            })}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t('export.csvAriaLabel')}
          >
            {t('export.csvButton')}
          </Button>
        </Stack>

        <Stack direction="row" spacing={1} mb={1.5} alignItems="center" flexWrap="wrap" role="group" aria-label={t('aria.presetGroup')}>
          <Typography variant="caption" color="text.secondary">
            {t('filter.presetLabel')}
          </Typography>
          <Chip size="small" variant="outlined" clickable onClick={() => applyPreset(24)} label={t('filter.preset24h')} />
          <Chip size="small" variant="outlined" clickable onClick={() => applyPreset(24 * 7)} label={t('filter.preset7d')} />
          <Chip size="small" variant="outlined" clickable onClick={() => applyPreset(24 * 30)} label={t('filter.preset30d')} />
          <Chip size="small" variant="outlined" clickable onClick={applyCustomPreset} label={t('filter.presetCustom')} />
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
          <TextField
            type="datetime-local"
            size="small"
            label={t('filter.sinceLabel')}
            value={sinceFilter}
            onChange={(e) => setSinceFilter(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 200 }}
            inputProps={{ 'aria-label': t('aria.filterSince') }}
          />
          <TextField
            type="datetime-local"
            size="small"
            label={t('filter.untilLabel')}
            value={untilFilter}
            onChange={(e) => setUntilFilter(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 200 }}
            inputProps={{ 'aria-label': t('aria.filterUntil') }}
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
                    selectable
                    selected={selectedIds.has(entry.id)}
                    onToggleSelected={toggleSelected}
                  />
                  {idx < items.length - 1 ? <Divider /> : null}
                </Box>
              );
            })}
          </Box>
        ) : null}

        {selectedIds.size > 0 ? (
          <Stack direction="row" spacing={1} mt={2} alignItems="center">
            <Button
              size="small"
              variant="contained"
              color="primary"
              disabled={bulkInProgress}
              onClick={() => setPendingBulkConfirm(true)}
            >
              {t('revert.bulkButton', { count: selectedIds.size })}
            </Button>
            <Button size="small" variant="text" onClick={clearSelection} disabled={bulkInProgress}>
              {t('filter.clear')}
            </Button>
          </Stack>
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
        open={pendingBulkConfirm}
        onClose={() => !bulkInProgress && setPendingBulkConfirm(false)}
        aria-labelledby="audit-bulk-revert-dialog-title"
        aria-describedby="audit-bulk-revert-dialog-body"
      >
        <DialogTitle id="audit-bulk-revert-dialog-title">{t('revert.bulkConfirmTitle')}</DialogTitle>
        <DialogContent>
          <DialogContentText id="audit-bulk-revert-dialog-body">
            {t('revert.bulkConfirmBody', { count: selectedIds.size })}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setPendingBulkConfirm(false)}
            disabled={bulkInProgress}
          >
            {t('revert.confirmCancel')}
          </Button>
          <Button
            onClick={() => void confirmBulkRevert()}
            variant="contained"
            color="primary"
            disabled={bulkInProgress}
            autoFocus
          >
            {bulkInProgress ? t('revert.inProgress') : t('revert.confirmAction')}
          </Button>
        </DialogActions>
      </Dialog>

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

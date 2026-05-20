import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Collapse,
  Divider,
  IconButton,
  Stack,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { listAudit, type AuditAction, type AuditEntry } from '../lib/audit';

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
}

function AuditEntryRow({ entry }: AuditEntryRowProps) {
  const { t } = useTranslation('audit');
  const [expanded, setExpanded] = useState(false);
  const formatted = formatTimestamp(entry.createdAt);
  const userLabel = entry.user || t('anonymousUser');
  const hasPayload = entry.payload !== null && entry.payload !== undefined;

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
      </Stack>
      {hasPayload ? (
        <Collapse in={expanded} unmountOnExit>
          <Box
            component="pre"
            sx={{
              mt: 1,
              p: 1.5,
              fontSize: '0.75rem',
              fontFamily: 'monospace',
              backgroundColor: (theme) => theme.palette.grey[100],
              borderRadius: 1,
              overflow: 'auto',
              maxHeight: 240,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {JSON.stringify(entry.payload, null, 2)}
          </Box>
        </Collapse>
      ) : null}
    </Box>
  );
}

export interface AuditHistoryPanelProps {
  entity: string;
  entityId: string;
}

export default function AuditHistoryPanel({ entity, entityId }: AuditHistoryPanelProps) {
  const { t } = useTranslation('audit');
  const [page, setPage] = useState(0);

  const query = useQuery({
    queryKey: ['audit', entity, entityId, page],
    queryFn: () => listAudit({ entity, entityId, page, pageSize: PAGE_SIZE }),
    enabled: Boolean(entity && entityId),
    keepPreviousData: true,
  });

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const hasMore = (page + 1) * PAGE_SIZE < total;

  return (
    <Card variant="outlined" aria-label={t('aria.panel')}>
      <CardContent>
        <Stack spacing={0.5} mb={2}>
          <Typography variant="h6">{t('title')}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t('subtitle')}
          </Typography>
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
            {items.map((entry, idx) => (
              <Box key={entry.id}>
                <AuditEntryRow entry={entry} />
                {idx < items.length - 1 ? <Divider /> : null}
              </Box>
            ))}
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
                onClick={() => setPage((p) => p + 1)}
                disabled={query.isFetching}
              >
                {t('loadMore')}
              </Button>
            ) : null}
          </Stack>
        ) : null}
      </CardContent>
    </Card>
  );
}

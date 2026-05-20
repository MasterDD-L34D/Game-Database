import { useMemo } from 'react';
import {
  Box,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { AuditAction } from '../lib/audit';

export interface AuditPayloadRendererProps {
  action: AuditAction;
  payload: unknown;
  /**
   * Optional prior-state object for diff rendering. When provided and action
   * is UPDATE, each field-row shows `oldValue → newValue` with color
   * highlights. Caller (e.g. AuditHistoryPanel) typically passes the next
   * entry's payload in chronological order (i.e. `items[idx+1].payload`
   * since the list is sorted createdAt DESC).
   */
  previousPayload?: unknown;
}

function captionKey(action: AuditAction, hasDiff: boolean): string {
  switch (action) {
    case 'CREATE':
      return 'payload.captionCreate';
    case 'UPDATE':
      return hasDiff ? 'payload.captionUpdateWithDiff' : 'payload.captionUpdate';
    case 'DELETE':
      return 'payload.captionDelete';
    default:
      return 'payload.captionGeneric';
  }
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return false;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

function formatScalar(value: unknown, t: (key: string, opts?: Record<string, unknown>) => string): string {
  if (value === null) return t('payload.valueNull');
  if (value === undefined) return t('payload.valueNull');
  if (typeof value === 'string') {
    return value === '' ? t('payload.valueEmpty') : value;
  }
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return t('payload.valueArray', { count: value.length });
  }
  if (typeof value === 'object') {
    return t('payload.valueObject');
  }
  return String(value);
}

function renderValueCell(value: unknown, t: (key: string, opts?: Record<string, unknown>) => string) {
  // Compact JSON preview for non-scalar values so the user sees a hint
  // beyond the placeholder label.
  if (value !== null && typeof value === 'object') {
    return (
      <Box>
        <Typography variant="body2" color="text.secondary" component="span">
          {formatScalar(value, t)}
        </Typography>
        <Box
          component="pre"
          sx={{
            mt: 0.5,
            mb: 0,
            p: 1,
            fontSize: '0.7rem',
            fontFamily: 'monospace',
            backgroundColor: (theme) => theme.palette.grey[100],
            borderRadius: 0.5,
            overflow: 'auto',
            maxHeight: 120,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {JSON.stringify(value, null, 2)}
        </Box>
      </Box>
    );
  }
  return <Typography variant="body2">{formatScalar(value, t)}</Typography>;
}

export default function AuditPayloadRenderer({ action, payload, previousPayload }: AuditPayloadRendererProps) {
  const { t } = useTranslation('audit');

  const entries = useMemo<Array<[string, unknown]>>(() => {
    if (payload === null || payload === undefined || typeof payload !== 'object' || Array.isArray(payload)) {
      return [];
    }
    return Object.entries(payload as Record<string, unknown>);
  }, [payload]);

  // Diff mode is only meaningful for UPDATE and when caller supplied a prior
  // object-shaped payload. CREATE has no "before"; DELETE shows the full
  // tombstoned record with no diff context.
  const previousMap = useMemo<Record<string, unknown> | null>(() => {
    if (action !== 'UPDATE') return null;
    if (previousPayload === null || previousPayload === undefined) return null;
    if (typeof previousPayload !== 'object' || Array.isArray(previousPayload)) return null;
    return previousPayload as Record<string, unknown>;
  }, [action, previousPayload]);
  const hasDiff = previousMap !== null;

  if (entries.length === 0) {
    // Fallback: render raw value (string/number/array) as monospace
    return (
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
        {JSON.stringify(payload, null, 2)}
      </Box>
    );
  }

  // Separate _revertedFrom marker (audit-trail link) from regular fields
  const revertedFromIdx = entries.findIndex(([k]) => k === '_revertedFrom');
  const revertedFrom = revertedFromIdx >= 0 ? entries[revertedFromIdx][1] : null;
  const visibleEntries = revertedFromIdx >= 0
    ? entries.filter(([k]) => k !== '_revertedFrom')
    : entries;

  return (
    <Box sx={{ mt: 1 }}>
      <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 0.5 }}>
        {t(captionKey(action, hasDiff))}
      </Typography>
      {revertedFrom ? (
        <Chip
          size="small"
          variant="outlined"
          color="info"
          label={t('payload.revertedFrom', { logId: String(revertedFrom) })}
          sx={{ mb: 1 }}
        />
      ) : null}
      <TableContainer sx={{ maxHeight: 320 }}>
        <Table size="small" stickyHeader aria-label={t(captionKey(action, hasDiff))}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600, width: hasDiff ? '24%' : '30%' }}>
                {t('payload.columnField')}
              </TableCell>
              {hasDiff ? (
                <>
                  <TableCell sx={{ fontWeight: 600, width: '38%' }}>
                    {t('payload.columnPrevious')}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>
                    {t('payload.columnNew')}
                  </TableCell>
                </>
              ) : (
                <TableCell sx={{ fontWeight: 600 }}>{t('payload.columnValue')}</TableCell>
              )}
            </TableRow>
          </TableHead>
          <TableBody>
            {visibleEntries.map(([key, value]) => {
              const prior = previousMap && Object.prototype.hasOwnProperty.call(previousMap, key)
                ? previousMap[key]
                : undefined;
              const priorMissing = previousMap !== null && !Object.prototype.hasOwnProperty.call(previousMap, key);
              const unchanged = previousMap !== null && deepEqual(prior, value);
              return (
                <TableRow key={key} hover>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem', verticalAlign: 'top' }}>
                    {key}
                  </TableCell>
                  {hasDiff ? (
                    <>
                      <TableCell sx={{ verticalAlign: 'top', backgroundColor: (theme) => unchanged ? 'transparent' : theme.palette.error.light, opacity: priorMissing ? 0.6 : 1 }}>
                        {priorMissing ? (
                          <Typography variant="body2" color="text.secondary" component="span">
                            {t('payload.valueMissing')}
                          </Typography>
                        ) : (
                          renderValueCell(prior, t)
                        )}
                      </TableCell>
                      <TableCell sx={{ verticalAlign: 'top', backgroundColor: (theme) => unchanged ? 'transparent' : theme.palette.success.light }}>
                        {unchanged ? (
                          <Typography variant="body2" color="text.secondary" component="span">
                            {t('payload.valueUnchanged')}
                          </Typography>
                        ) : (
                          renderValueCell(value, t)
                        )}
                      </TableCell>
                    </>
                  ) : (
                    <TableCell sx={{ verticalAlign: 'top' }}>
                      {renderValueCell(value, t)}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

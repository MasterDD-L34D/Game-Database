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
}

function captionKey(action: AuditAction): string {
  switch (action) {
    case 'CREATE':
      return 'payload.captionCreate';
    case 'UPDATE':
      return 'payload.captionUpdate';
    case 'DELETE':
      return 'payload.captionDelete';
    default:
      return 'payload.captionGeneric';
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

export default function AuditPayloadRenderer({ action, payload }: AuditPayloadRendererProps) {
  const { t } = useTranslation('audit');

  const entries = useMemo<Array<[string, unknown]>>(() => {
    if (payload === null || payload === undefined || typeof payload !== 'object' || Array.isArray(payload)) {
      return [];
    }
    return Object.entries(payload as Record<string, unknown>);
  }, [payload]);

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
        {t(captionKey(action))}
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
        <Table size="small" stickyHeader aria-label={t(captionKey(action))}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600, width: '30%' }}>
                {t('payload.columnField')}
              </TableCell>
              <TableCell sx={{ fontWeight: 600 }}>{t('payload.columnValue')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {visibleEntries.map(([key, value]) => (
              <TableRow key={key} hover>
                <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem', verticalAlign: 'top' }}>
                  {key}
                </TableCell>
                <TableCell sx={{ verticalAlign: 'top' }}>
                  {renderValueCell(value, t)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

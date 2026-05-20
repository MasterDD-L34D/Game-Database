import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AuditHistoryPanel from '../AuditHistoryPanel';
import * as auditLib from '../../lib/audit';

function renderWithClient(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

const sampleEntries = [
  {
    id: 'audit-1',
    entity: 'Trait',
    entityId: 'trait-1',
    action: 'CREATE' as const,
    user: 'alice@example.com',
    payload: { slug: 'foo', name: 'Foo' },
    createdAt: '2026-05-20T10:00:00Z',
  },
  {
    id: 'audit-2',
    entity: 'Trait',
    entityId: 'trait-1',
    action: 'UPDATE' as const,
    user: null,
    payload: null,
    createdAt: '2026-05-20T11:30:00Z',
  },
];

describe('AuditHistoryPanel', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders Italian section title + loading indicator', () => {
    vi.spyOn(auditLib, 'listAudit').mockImplementation(
      () => new Promise(() => undefined), // never resolves → keeps loading
    );

    renderWithClient(<AuditHistoryPanel entity="Trait" entityId="trait-1" />);

    expect(screen.getByText('Cronologia modifiche')).toBeInTheDocument();
    expect(screen.getByText('Caricamento cronologia...')).toBeInTheDocument();
  });

  it('renders Italian empty message when no entries', async () => {
    vi.spyOn(auditLib, 'listAudit').mockResolvedValue({
      items: [],
      page: 0,
      pageSize: 10,
      total: 0,
    });

    renderWithClient(<AuditHistoryPanel entity="Trait" entityId="trait-1" />);

    await waitFor(() =>
      expect(screen.getByText('Nessuna modifica registrata')).toBeInTheDocument(),
    );
  });

  it('renders Italian action chips + anonymous user fallback', async () => {
    vi.spyOn(auditLib, 'listAudit').mockResolvedValue({
      items: sampleEntries,
      page: 0,
      pageSize: 10,
      total: 2,
    });

    renderWithClient(<AuditHistoryPanel entity="Trait" entityId="trait-1" />);

    await waitFor(() => expect(screen.getByText('Creato')).toBeInTheDocument());
    expect(screen.getByText('Aggiornato')).toBeInTheDocument();
    expect(screen.getByText('alice@example.com', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Utente anonimo', { exact: false })).toBeInTheDocument();
  });

  it('expands payload on toggle click', async () => {
    vi.spyOn(auditLib, 'listAudit').mockResolvedValue({
      items: [sampleEntries[0]], // has payload
      page: 0,
      pageSize: 10,
      total: 1,
    });

    renderWithClient(<AuditHistoryPanel entity="Trait" entityId="trait-1" />);

    await waitFor(() => expect(screen.getByText('Creato')).toBeInTheDocument());

    const toggle = screen.getByLabelText('Mostra dettagli payload');
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(screen.getByText(/"slug": "foo"/)).toBeInTheDocument();
    });

    // Toggle label flips
    expect(screen.getByLabelText('Nascondi dettagli payload')).toBeInTheDocument();
  });

  it('renders Italian error message on load failure', async () => {
    vi.spyOn(auditLib, 'listAudit').mockRejectedValue(new Error('HTTP 500'));

    renderWithClient(<AuditHistoryPanel entity="Trait" entityId="trait-1" />);

    await waitFor(() =>
      expect(screen.getByText('Impossibile caricare la cronologia')).toBeInTheDocument(),
    );
  });

  it('exposes Italian aria-label on panel root', async () => {
    vi.spyOn(auditLib, 'listAudit').mockResolvedValue({
      items: [],
      page: 0,
      pageSize: 10,
      total: 0,
    });

    renderWithClient(<AuditHistoryPanel entity="Trait" entityId="trait-1" />);

    expect(
      screen.getByLabelText('Cronologia modifiche entità'),
    ).toBeInTheDocument();
  });

  // Codex P2 regression (PR #127): "Carica altri" must APPEND new page entries,
  // not replace the visible list.
  it('preserves previously rendered entries when "Carica altri" loads next page', async () => {
    const page0Items = Array.from({ length: 10 }, (_, i) => ({
      id: `audit-p0-${i}`,
      entity: 'Trait',
      entityId: 'trait-1',
      action: 'UPDATE' as const,
      user: `user-${i}@example.com`,
      payload: null,
      createdAt: `2026-05-${String(20 - i).padStart(2, '0')}T10:00:00Z`,
    }));
    const page1Items = Array.from({ length: 5 }, (_, i) => ({
      id: `audit-p1-${i}`,
      entity: 'Trait',
      entityId: 'trait-1',
      action: 'CREATE' as const,
      user: `older-${i}@example.com`,
      payload: null,
      createdAt: `2026-05-${String(10 - i).padStart(2, '0')}T10:00:00Z`,
    }));

    const listAuditSpy = vi.spyOn(auditLib, 'listAudit');
    listAuditSpy.mockImplementation(async ({ page = 0 }) => {
      if (page === 0) return { items: page0Items, page: 0, pageSize: 10, total: 15 };
      if (page === 1) return { items: page1Items, page: 1, pageSize: 10, total: 15 };
      return { items: [], page, pageSize: 10, total: 15 };
    });

    renderWithClient(<AuditHistoryPanel entity="Trait" entityId="trait-1" />);

    // Wait for page 0 to render
    await waitFor(() => expect(screen.getByText('user-0@example.com', { exact: false })).toBeInTheDocument());
    expect(screen.getByText('user-9@example.com', { exact: false })).toBeInTheDocument();

    // Click "Carica altri"
    const loadMore = screen.getByRole('button', { name: 'Carica altri' });
    fireEvent.click(loadMore);

    // Wait for page 1 to be appended (older-0 visible)
    await waitFor(() => expect(screen.getByText('older-0@example.com', { exact: false })).toBeInTheDocument());

    // CRITICAL: page 0 items STILL visible after load-more (the original bug)
    expect(screen.getByText('user-0@example.com', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('user-9@example.com', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('older-4@example.com', { exact: false })).toBeInTheDocument();
  });
});

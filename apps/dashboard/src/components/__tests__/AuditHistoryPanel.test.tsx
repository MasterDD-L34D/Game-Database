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
});

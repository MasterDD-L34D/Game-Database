import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AuditHistoryPanel from '../AuditHistoryPanel';
import { SnackbarProvider } from '../SnackbarProvider';
import * as auditLib from '../../lib/audit';

function renderWithClient(ui: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <SnackbarProvider>{ui}</SnackbarProvider>
    </QueryClientProvider>,
  );
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
      // New AuditPayloadRenderer table renders key cell + value cell
      // (caption "Campi dell'entità creata" for CREATE action)
      expect(screen.getByText("Campi dell'entità creata")).toBeInTheDocument();
      expect(screen.getByText('slug')).toBeInTheDocument();
      expect(screen.getByText('foo')).toBeInTheDocument();
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

  // ---- Revert button (Fase 2 3/N) ----

  const deleteEntry = {
    id: 'audit-delete-1',
    entity: 'Trait',
    entityId: 'trait-1',
    action: 'DELETE' as const,
    user: 'alice@example.com',
    payload: { id: 'trait-1', slug: 'foo', name: 'Foo', dataType: 'TEXT' },
    createdAt: '2026-05-20T10:00:00Z',
  };

  it('shows Ripristina button ONLY for DELETE entries', async () => {
    const mixed = [
      deleteEntry,
      {
        ...deleteEntry,
        id: 'audit-update-1',
        action: 'UPDATE' as const,
        payload: { name: 'New' },
      },
      {
        ...deleteEntry,
        id: 'audit-create-1',
        action: 'CREATE' as const,
        payload: { id: 'trait-1', slug: 'foo', name: 'Foo', dataType: 'TEXT' },
      },
    ];
    vi.spyOn(auditLib, 'listAudit').mockResolvedValue({
      items: mixed,
      page: 0,
      pageSize: 10,
      total: 3,
    });

    renderWithClient(<AuditHistoryPanel entity="Trait" entityId="trait-1" />);

    await waitFor(() => expect(screen.getByText('Eliminato')).toBeInTheDocument());
    // Exactly one Ripristina button (for the DELETE row only)
    const buttons = screen.getAllByRole('button', { name: /^Ripristina entit/ });
    expect(buttons).toHaveLength(1);
  });

  it('opens confirmation dialog on revert click (does NOT call revertAudit immediately)', async () => {
    vi.spyOn(auditLib, 'listAudit').mockResolvedValue({
      items: [deleteEntry],
      page: 0,
      pageSize: 10,
      total: 1,
    });
    const revertSpy = vi.spyOn(auditLib, 'revertAudit').mockResolvedValue({
      success: true,
      id: 'trait-1',
      entity: 'Trait',
      revertedFrom: 'audit-delete-1',
    });

    renderWithClient(<AuditHistoryPanel entity="Trait" entityId="trait-1" />);

    await waitFor(() => expect(screen.getByText('Eliminato')).toBeInTheDocument());

    const revertBtn = screen.getByRole('button', { name: /^Ripristina entit/ });
    fireEvent.click(revertBtn);

    // Dialog appears
    await waitFor(() =>
      expect(screen.getByText('Confermare il ripristino?')).toBeInTheDocument(),
    );
    expect(screen.getByText(/Stai per ripristinare l'entità Trait \(id trait-1\)/)).toBeInTheDocument();

    // revertAudit NOT called yet — waits for confirm
    expect(revertSpy).not.toHaveBeenCalled();
  });

  it('cancels dialog without calling revertAudit', async () => {
    vi.spyOn(auditLib, 'listAudit').mockResolvedValue({
      items: [deleteEntry],
      page: 0,
      pageSize: 10,
      total: 1,
    });
    const revertSpy = vi.spyOn(auditLib, 'revertAudit').mockResolvedValue({
      success: true,
      id: 'trait-1',
      entity: 'Trait',
      revertedFrom: 'audit-delete-1',
    });

    renderWithClient(<AuditHistoryPanel entity="Trait" entityId="trait-1" />);

    await waitFor(() => expect(screen.getByText('Eliminato')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /^Ripristina entit/ }));
    await waitFor(() =>
      expect(screen.getByText('Confermare il ripristino?')).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Annulla' }));

    await waitFor(() =>
      expect(screen.queryByText('Confermare il ripristino?')).not.toBeInTheDocument(),
    );
    expect(revertSpy).not.toHaveBeenCalled();
  });

  it('calls revertAudit + shows success toast after confirm', async () => {
    vi.spyOn(auditLib, 'listAudit').mockResolvedValue({
      items: [deleteEntry],
      page: 0,
      pageSize: 10,
      total: 1,
    });
    const revertSpy = vi.spyOn(auditLib, 'revertAudit').mockResolvedValue({
      success: true,
      id: 'trait-1',
      entity: 'Trait',
      revertedFrom: 'audit-delete-1',
    });

    renderWithClient(<AuditHistoryPanel entity="Trait" entityId="trait-1" />);

    await waitFor(() => expect(screen.getByText('Eliminato')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /^Ripristina entit/ }));
    await waitFor(() =>
      expect(screen.getByText('Confermare il ripristino?')).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Conferma ripristino' }));

    await waitFor(() => expect(revertSpy).toHaveBeenCalledWith('audit-delete-1'));
    await waitFor(() =>
      expect(screen.getByText(/Entità Trait ripristinata con successo/)).toBeInTheDocument(),
    );
  });

  it('shows Italian conflict toast on 409 error after confirm', async () => {
    vi.spyOn(auditLib, 'listAudit').mockResolvedValue({
      items: [deleteEntry],
      page: 0,
      pageSize: 10,
      total: 1,
    });
    vi.spyOn(auditLib, 'revertAudit').mockRejectedValue(new Error('HTTP 409'));

    renderWithClient(<AuditHistoryPanel entity="Trait" entityId="trait-1" />);

    await waitFor(() => expect(screen.getByText('Eliminato')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /^Ripristina entit/ }));
    await waitFor(() => expect(screen.getByText('Confermare il ripristino?')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Conferma ripristino' }));

    await waitFor(() =>
      expect(screen.getByText(/Conflitto: un'altra entità ha lo stesso slug o id/)).toBeInTheDocument(),
    );
  });

  it('shows Italian not-revertable toast on 400 error after confirm', async () => {
    vi.spyOn(auditLib, 'listAudit').mockResolvedValue({
      items: [deleteEntry],
      page: 0,
      pageSize: 10,
      total: 1,
    });
    vi.spyOn(auditLib, 'revertAudit').mockRejectedValue(new Error('HTTP 400'));

    renderWithClient(<AuditHistoryPanel entity="Trait" entityId="trait-1" />);

    await waitFor(() => expect(screen.getByText('Eliminato')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /^Ripristina entit/ }));
    await waitFor(() => expect(screen.getByText('Confermare il ripristino?')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Conferma ripristino' }));

    await waitFor(() =>
      expect(screen.getByText(/Solo le eliminazioni \(DELETE\) sono ripristinabili/)).toBeInTheDocument(),
    );
  });

  // ---- CSV export (Fase 2 11/N) ----

  it('renders "Esporta CSV" button with anchor pointing to /api/audit?format=csv', async () => {
    vi.spyOn(auditLib, 'listAudit').mockResolvedValue({
      items: [],
      page: 0,
      pageSize: 10,
      total: 0,
    });

    renderWithClient(<AuditHistoryPanel entity="Trait" entityId="trait-1" />);

    const btn = await screen.findByRole('link', { name: /^Esporta cronologia/ });
    const href = btn.getAttribute('href');
    expect(href).toMatch(/\/audit\?.*format=csv/);
    expect(href).toMatch(/entity=Trait/);
    expect(href).toMatch(/entityId=trait-1/);
  });

  it('CSV export URL includes active filters (action + user + since + until)', async () => {
    vi.spyOn(auditLib, 'listAudit').mockResolvedValue({
      items: [],
      page: 0,
      pageSize: 10,
      total: 0,
    });

    renderWithClient(<AuditHistoryPanel entity="Trait" entityId="trait-1" />);

    // Apply user filter
    fireEvent.change(screen.getByLabelText('Filtra per utente'), { target: { value: 'alice@example.com' } });
    // Apply 24h preset
    fireEvent.click(screen.getByText('Ultime 24h'));

    await waitFor(
      () => {
        const btn = screen.getByRole('link', { name: /^Esporta cronologia/ });
        const href = btn.getAttribute('href') || '';
        expect(href).toMatch(/user=alice/);
        expect(href).toMatch(/since=\d{4}-\d{2}-\d{2}T/);
        expect(href).toMatch(/until=\d{4}-\d{2}-\d{2}T/);
      },
      { timeout: 1500 },
    );
  });

  // ---- Filter UI (Fase 2 8/N) ----

  it('renders Italian action filter labels + "Tutte le azioni" default option', async () => {
    vi.spyOn(auditLib, 'listAudit').mockResolvedValue({
      items: [],
      page: 0,
      pageSize: 10,
      total: 0,
    });

    renderWithClient(<AuditHistoryPanel entity="Trait" entityId="trait-1" />);

    // Action filter label rendered as form label (MUI TextField select)
    expect(screen.getByLabelText('Filtra per azione')).toBeInTheDocument();
    expect(screen.getByLabelText('Filtra per utente')).toBeInTheDocument();
  });

  it('debounces user filter input + passes trimmed value to listAudit', async () => {
    const listSpy = vi.spyOn(auditLib, 'listAudit').mockResolvedValue({
      items: [],
      page: 0,
      pageSize: 10,
      total: 0,
    });

    renderWithClient(<AuditHistoryPanel entity="Trait" entityId="trait-1" />);

    // Initial call: no user filter
    await waitFor(() =>
      expect(listSpy).toHaveBeenCalledWith(
        expect.objectContaining({ user: undefined }),
      ),
    );

    const userInput = screen.getByLabelText('Filtra per utente');
    fireEvent.change(userInput, { target: { value: '  alice@example.com  ' } });

    // Debounce 300ms — must wait > debounce window
    await waitFor(
      () =>
        expect(listSpy).toHaveBeenCalledWith(
          expect.objectContaining({ user: 'alice@example.com' }),
        ),
      { timeout: 1500 },
    );
  });

  it('hides Pulisci button when no filters active', async () => {
    vi.spyOn(auditLib, 'listAudit').mockResolvedValue({
      items: [],
      page: 0,
      pageSize: 10,
      total: 0,
    });

    renderWithClient(<AuditHistoryPanel entity="Trait" entityId="trait-1" />);

    // Wait for initial render
    await waitFor(() => expect(screen.getByLabelText('Filtra per azione')).toBeInTheDocument());

    // No active filters → no Pulisci button
    expect(screen.queryByLabelText('Pulisci filtri')).not.toBeInTheDocument();
  });

  it('preset chip "Ultime 24h" prefills since/until ~24h window', async () => {
    const listSpy = vi.spyOn(auditLib, 'listAudit').mockResolvedValue({
      items: [],
      page: 0,
      pageSize: 10,
      total: 0,
    });

    renderWithClient(<AuditHistoryPanel entity="Trait" entityId="trait-1" />);

    const chip24h = screen.getByText('Ultime 24h');
    fireEvent.click(chip24h);

    await waitFor(() => {
      const lastCall = listSpy.mock.lastCall?.[0];
      expect(lastCall?.since).toBeTruthy();
      expect(lastCall?.until).toBeTruthy();
      const sinceMs = new Date(lastCall!.since!).getTime();
      const untilMs = new Date(lastCall!.until!).getTime();
      const diffHours = (untilMs - sinceMs) / (60 * 60 * 1000);
      // Allow tolerance (preset triggers immediately, clock skew + minute rounding):
      // 24h ± 2 minutes
      expect(diffHours).toBeGreaterThan(23.95);
      expect(diffHours).toBeLessThan(24.05);
    });
  });

  it('preset chip "Ultimi 7 giorni" prefills ~168h window', async () => {
    const listSpy = vi.spyOn(auditLib, 'listAudit').mockResolvedValue({
      items: [],
      page: 0,
      pageSize: 10,
      total: 0,
    });

    renderWithClient(<AuditHistoryPanel entity="Trait" entityId="trait-1" />);

    fireEvent.click(screen.getByText('Ultimi 7 giorni'));

    await waitFor(() => {
      const lastCall = listSpy.mock.lastCall?.[0];
      const sinceMs = new Date(lastCall!.since!).getTime();
      const untilMs = new Date(lastCall!.until!).getTime();
      const diffHours = (untilMs - sinceMs) / (60 * 60 * 1000);
      expect(diffHours).toBeGreaterThan(167.9);
      expect(diffHours).toBeLessThan(168.1);
    });
  });

  it('preset chip "Personalizzato" clears since/until to empty', async () => {
    const listSpy = vi.spyOn(auditLib, 'listAudit').mockResolvedValue({
      items: [],
      page: 0,
      pageSize: 10,
      total: 0,
    });

    renderWithClient(<AuditHistoryPanel entity="Trait" entityId="trait-1" />);

    // First apply 24h preset
    fireEvent.click(screen.getByText('Ultime 24h'));
    await waitFor(() => {
      expect(listSpy.mock.lastCall?.[0]?.since).toBeTruthy();
    });

    // Then click Personalizzato → cleared
    fireEvent.click(screen.getByText('Personalizzato'));
    await waitFor(() => {
      expect(listSpy.mock.lastCall?.[0]?.since).toBeUndefined();
      expect(listSpy.mock.lastCall?.[0]?.until).toBeUndefined();
    });
  });

  it('passes since/until to listAudit as UTC ISO strings (tz-normalized)', async () => {
    // Codex P1 fix from PR #137: datetime-local is tz-naive; client must
    // convert to absolute UTC ISO via browser tz before sending.
    const listSpy = vi.spyOn(auditLib, 'listAudit').mockResolvedValue({
      items: [],
      page: 0,
      pageSize: 10,
      total: 0,
    });

    renderWithClient(<AuditHistoryPanel entity="Trait" entityId="trait-1" />);

    const sinceInput = screen.getByLabelText('Filtra da data');
    const untilInput = screen.getByLabelText('Filtra a data');

    fireEvent.change(sinceInput, { target: { value: '2026-03-01T00:00' } });
    fireEvent.change(untilInput, { target: { value: '2026-05-01T00:00' } });

    // Expected: forwarded as ISO with explicit tz (Z suffix because UTC).
    // Don't pin exact value — depends on the test env's local tz, but
    // must end with Z and be valid ISO.
    await waitFor(() => {
      const lastCall = listSpy.mock.lastCall?.[0];
      expect(lastCall?.since).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
      expect(lastCall?.until).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z$/);
      // Order preserved: since corresponds to earlier wall-clock value
      expect(new Date(lastCall!.since!).getTime()).toBeLessThan(new Date(lastCall!.until!).getTime());
    });
  });

  it('shows Pulisci button when only since filter is set', async () => {
    vi.spyOn(auditLib, 'listAudit').mockResolvedValue({
      items: [],
      page: 0,
      pageSize: 10,
      total: 0,
    });

    renderWithClient(<AuditHistoryPanel entity="Trait" entityId="trait-1" />);

    const sinceInput = screen.getByLabelText('Filtra da data');
    fireEvent.change(sinceInput, { target: { value: '2026-03-01T00:00' } });

    await waitFor(() =>
      expect(screen.getByLabelText('Pulisci filtri')).toBeInTheDocument(),
    );
  });

  it('shows Pulisci button when user filter is set, clears state on click', async () => {
    const listSpy = vi.spyOn(auditLib, 'listAudit').mockResolvedValue({
      items: [],
      page: 0,
      pageSize: 10,
      total: 0,
    });

    renderWithClient(<AuditHistoryPanel entity="Trait" entityId="trait-1" />);

    const userInput = screen.getByLabelText('Filtra per utente');
    fireEvent.change(userInput, { target: { value: 'alice@example.com' } });

    // Wait for debounce → Pulisci button appears
    const clearBtn = await screen.findByLabelText('Pulisci filtri', {}, { timeout: 1500 });

    fireEvent.click(clearBtn);

    // After clear: input emptied + button hidden + listAudit called with undefined user
    await waitFor(() => expect(userInput).toHaveValue(''));
    expect(screen.queryByLabelText('Pulisci filtri')).not.toBeInTheDocument();
    await waitFor(() =>
      expect(listSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ user: undefined }),
      ),
    );
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

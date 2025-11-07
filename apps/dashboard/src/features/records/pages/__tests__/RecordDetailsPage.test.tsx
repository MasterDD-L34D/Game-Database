import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach, type Mock } from 'vitest';
import RecordDetailsPage from '../RecordDetailsPage';
import type { RecordRow } from '../../../../types/record';
import * as recordsApi from '../../../../lib/records';

vi.mock('../../../../lib/records', async () => {
  const actual = await vi.importActual<typeof import('../../../../lib/records')>(
    '../../../../lib/records',
  );
  return {
    ...actual,
    getRecord: vi.fn(),
    updateRecord: vi.fn(),
  };
});

const getRecordMock = recordsApi.getRecord as unknown as Mock;

describe('RecordDetailsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRecordMock.mockReset();
  });

  function renderPage(initialEntry = '/records/1') {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route path="/records/:recordId" element={<RecordDetailsPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  }

  it('renders record details after loading data', async () => {
    const record: RecordRow = {
      id: '1',
      nome: 'Test Record',
      stato: 'Attivo',
      descrizione: 'Descrizione di prova',
    };
    getRecordMock.mockResolvedValue(record);

    renderPage();

    expect(await screen.findByRole('heading', { name: /test record/i })).toBeInTheDocument();
    expect(screen.getByText(/descrizione di prova/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /modifica/i })).toBeEnabled();
  });

  it('shows an error message when the query fails', async () => {
    getRecordMock.mockRejectedValue(new Error('Errore di rete'));

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/errore di rete/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /riprova/i })).toBeInTheDocument();
  });

  it('renders fallback when record id is missing', async () => {
    renderPage('/records/');

    expect(await screen.findByText(/identificativo record non valido/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /torna all'elenco/i })).toBeInTheDocument();
  });
});

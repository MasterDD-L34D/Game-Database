import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach, afterEach, type Mock } from 'vitest';
import RecordEditPage from '../RecordEditPage';
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
const updateRecordMock = recordsApi.updateRecord as unknown as Mock;

describe('RecordEditPage', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    getRecordMock.mockReset();
    updateRecordMock.mockReset();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  function renderPage(initialEntry = '/records/1/edit') {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route path="/records/:recordId/edit" element={<RecordEditPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  }

  it('prefills the form with the record data', async () => {
    const record: RecordRow = {
      id: '1',
      nome: 'Record esistente',
      stato: 'Attivo',
      descrizione: 'Descrizione originale',
      stile: 'Brush',
    };
    getRecordMock.mockResolvedValue(record);

    renderPage();

    expect(await screen.findByDisplayValue(/record esistente/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue(/descrizione originale/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('Brush')).toBeInTheDocument();
  });

  it('invokes updateRecord when the form is submitted', async () => {
    const record: RecordRow = {
      id: '1',
      nome: 'Record esistente',
      stato: 'Bozza',
    };
    getRecordMock.mockResolvedValue(record);
    updateRecordMock.mockResolvedValue({ ...record, nome: 'Record aggiornato' });

    const user = userEvent.setup();
    renderPage();

    const nameInput = await screen.findByLabelText(/nome/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'Record aggiornato');

    await user.click(screen.getByRole('button', { name: /salva modifiche/i }));

    await waitFor(() => {
      expect(updateRecordMock).toHaveBeenCalledWith('1', expect.objectContaining({ nome: 'Record aggiornato' }));
    });
  });

  it('does not emit out-of-range warnings when optional select values are missing', async () => {
    const partialRecord = {
      id: '1',
      nome: 'Record parziale',
      stato: 'Attivo',
    } satisfies Partial<RecordRow>;

    getRecordMock.mockResolvedValue(partialRecord);

    renderPage();

    expect(await screen.findByDisplayValue(/record parziale/i)).toBeInTheDocument();

    await waitFor(() => {
      const warningCalls = consoleWarnSpy.mock.calls.filter((call) =>
        call.some(
          (arg) =>
            typeof arg === 'string' && arg.includes('MUI: The value provided to Select input component is invalid'),
        ),
      );

      const errorCalls = consoleErrorSpy.mock.calls.filter((call) =>
        call.some(
          (arg) =>
            typeof arg === 'string' && arg.includes('MUI: The value provided to Select input component is invalid'),
        ),
      );

      expect(warningCalls).toHaveLength(0);
      expect(errorCalls).toHaveLength(0);
    });
  });
});

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PaginationBar from '../PaginationBar';

describe('PaginationBar (i18n a11y)', () => {
  it('exposes Italian aria-label on pagination navigation buttons', () => {
    render(
      <PaginationBar
        count={100}
        page={1}
        rowsPerPage={10}
        onPageChange={vi.fn()}
        onRowsPerPageChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Vai alla pagina precedente')).toBeInTheDocument();
    expect(screen.getByLabelText('Vai alla pagina successiva')).toBeInTheDocument();
  });

  it('renders Italian labelDisplayedRows', () => {
    render(
      <PaginationBar
        count={100}
        page={0}
        rowsPerPage={10}
        onPageChange={vi.fn()}
        onRowsPerPageChange={vi.fn()}
      />,
    );

    // Default MUI pattern: "1–10 di 100" (Italian — was "1-10 of 100" before fix)
    expect(screen.getByText(/1–10 di 100/)).toBeInTheDocument();
  });

  it('renders Italian rowsPerPage label', () => {
    render(
      <PaginationBar
        count={100}
        page={0}
        rowsPerPage={10}
        onPageChange={vi.fn()}
        onRowsPerPageChange={vi.fn()}
      />,
    );

    expect(screen.getByText(/Righe per pagina/)).toBeInTheDocument();
  });
});

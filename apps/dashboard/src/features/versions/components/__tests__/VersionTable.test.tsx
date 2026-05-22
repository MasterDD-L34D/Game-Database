import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../../testUtils/renderWithProviders';
import VersionTable from '../VersionTable';
import type { TaxonomyVersion } from '../../../../lib/taxonomy';

const draft: TaxonomyVersion = { id: '1', tag: 'v2.0.0', status: 'draft', description: null, releasedAt: null, releasedBy: null, createdAt: '', updatedAt: '' };
const released: TaxonomyVersion = { id: '2', tag: 'v1.0.0', status: 'released', description: 'base', releasedAt: '2026-01-01T00:00:00.000Z', releasedBy: 'admin', createdAt: '', updatedAt: '' };
const retired: TaxonomyVersion = { id: '3', tag: 'v0.9.0', status: 'retired', description: null, releasedAt: '2025-12-01T00:00:00.000Z', releasedBy: 'admin', createdAt: '', updatedAt: '' };

function setup(versions: TaxonomyVersion[]) {
  const handlers = { onRelease: vi.fn(), onRetire: vi.fn(), onDelete: vi.fn(), onDetails: vi.fn() };
  renderWithProviders(<VersionTable versions={versions} busy={false} {...handlers} />);
  return handlers;
}

describe('VersionTable', () => {
  it('shows Release + Delete for a draft and fires the handlers', async () => {
    const user = userEvent.setup();
    const h = setup([draft]);
    await user.click(screen.getByRole('button', { name: /rilascia/i }));
    expect(h.onRelease).toHaveBeenCalledWith(draft);
    await user.click(screen.getByRole('button', { name: /elimina/i }));
    expect(h.onDelete).toHaveBeenCalledWith(draft);
    expect(screen.queryByRole('button', { name: /ritira/i })).toBeNull();
  });

  it('shows Retire (not Release/Delete) for a released version', () => {
    setup([released]);
    expect(screen.getByRole('button', { name: /ritira/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /rilascia/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /elimina/i })).toBeNull();
  });

  it('shows only Details for a retired version', () => {
    const h = setup([retired]);
    expect(screen.queryByRole('button', { name: /ritira/i })).toBeNull();
    expect(screen.getByRole('button', { name: /dettagli/i })).toBeTruthy();
    void h;
  });
});

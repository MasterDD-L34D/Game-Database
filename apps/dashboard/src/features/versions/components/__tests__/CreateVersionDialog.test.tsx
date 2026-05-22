import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../../../testUtils/renderWithProviders';
import CreateVersionDialog from '../CreateVersionDialog';

describe('CreateVersionDialog', () => {
  it('rejects a non-semver tag and does not submit', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async () => {});
    renderWithProviders(<CreateVersionDialog open onClose={() => {}} onSubmit={onSubmit} submitting={false} />);
    await user.type(screen.getByLabelText(/tag/i), 'not-semver');
    await user.click(screen.getByRole('button', { name: /crea bozza/i }));
    expect(await screen.findByText(/semver/i)).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits tag + description for a valid semver tag', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(async () => {});
    renderWithProviders(<CreateVersionDialog open onClose={() => {}} onSubmit={onSubmit} submitting={false} />);
    await user.type(screen.getByLabelText(/tag/i), 'v1.2.0');
    await user.type(screen.getByLabelText(/descrizione/i), 'note');
    await user.click(screen.getByRole('button', { name: /crea bozza/i }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ tag: 'v1.2.0', description: 'note' }));
  });
});

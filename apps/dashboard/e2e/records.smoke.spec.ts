import { expect, test } from '@playwright/test';

test.describe('records smoke', () => {
  test('renders the live records list', async ({ page }) => {
    await page.goto('/records');

    const main = page.getByRole('main');

    await expect(page.getByRole('heading', { name: 'Record' })).toBeVisible();
    await expect(main.getByRole('button', { name: 'Aggiungi' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Nome' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Stato' })).toBeVisible();
  });
});

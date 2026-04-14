import { expect, test } from '@playwright/test';

test.describe('species detail navigation', () => {
  test('navigates from species list to related biome and ecosystem details', async ({ page }) => {
    await page.goto('/species/falco-pellegrino');
    await expect(page.getByRole('heading', { name: 'Falco peregrinus' })).toBeVisible();

    await page.getByRole('link', { name: 'Foresta montana di conifere' }).click();
    await expect(page.getByRole('heading', { name: 'Foresta montana di conifere' })).toBeVisible();
  });
});

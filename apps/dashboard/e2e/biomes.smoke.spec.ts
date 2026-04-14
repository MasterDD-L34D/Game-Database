import { expect, test } from '@playwright/test';

test.describe('biomes smoke', () => {
  test('renders seeded biomes from the live API', async ({ page }) => {
    await page.goto('/biomes');
    const main = page.getByRole('main');

    await expect(main.getByRole('heading', { name: 'Biomi' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nuovo bioma' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Foresta temperata mista' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Macchia mediterranea' })).toBeVisible();
  });
});

import { expect, test } from '@playwright/test';

test.describe('biomes CRUD', () => {
  test('creates, edits, and deletes a biome through the live UI', async ({ page }) => {
    await page.context().setExtraHTTPHeaders({
      'X-Roles': 'taxonomy:write',
    });

    const suffix = Date.now().toString().slice(-6);
    const slug = `playwright-biome-${suffix}`;
    const name = `Playwright Biome ${suffix}`;
    const updatedName = `Playwright Biome ${suffix} Updated`;
    const updatedClimate = 'Oceanico di test';
    const updatedDescription = 'Bioma creato e modificato da smoke test Playwright.';

    await page.goto('/biomes');

    await expect(page.getByRole('heading', { name: 'Biomi' })).toBeVisible();
    await page.getByRole('button', { name: 'Nuovo bioma' }).click();

    const createDialog = page.getByRole('dialog');
    await expect(createDialog.getByText('Aggiungi bioma')).toBeVisible();
    await createDialog.getByLabel('Slug').fill(slug);
    await createDialog.getByLabel('Nome').fill(name);
    await createDialog.getByLabel('Clima').fill('Temperato di test');
    await createDialog.getByLabel('Descrizione').fill('Bioma creato da smoke test Playwright.');
    await createDialog.getByRole('button', { name: 'Salva' }).click();

    await expect(page.getByText('Bioma creato con successo.')).toBeVisible();
    await expect(page.getByRole('cell', { name })).toBeVisible();

    const createdRow = page.locator('tr', { has: page.getByRole('cell', { name }) });
    await createdRow.getByRole('button', { name: 'Azioni' }).click();
    await page.getByRole('menuitem', { name: 'Modifica' }).click();

    const editDialog = page.getByRole('dialog');
    await expect(editDialog.getByText('Modifica bioma')).toBeVisible();
    await editDialog.getByLabel('Nome').fill(updatedName);
    await editDialog.getByLabel('Clima').fill(updatedClimate);
    await editDialog.getByLabel('Descrizione').fill(updatedDescription);
    await editDialog.getByRole('button', { name: 'Salva modifiche' }).click();

    await expect(page.getByText('Bioma aggiornato con successo.')).toBeVisible();
    await expect(page.getByRole('cell', { name: updatedName })).toBeVisible();

    const updatedRow = page.locator('tr', { has: page.getByRole('cell', { name: updatedName }) });
    await updatedRow.getByRole('button', { name: 'Azioni' }).click();
    await page.getByRole('menuitem', { name: 'Elimina' }).click();

    const deleteDialog = page.getByRole('dialog');
    await expect(deleteDialog.getByText('Elimina bioma')).toBeVisible();
    await deleteDialog.getByRole('button', { name: 'Elimina' }).click();

    await expect(page.getByText('Bioma eliminato con successo.')).toBeVisible();
    await expect(page.getByRole('cell', { name: updatedName })).toHaveCount(0);
  });
});

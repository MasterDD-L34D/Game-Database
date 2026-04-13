import { expect, test } from '@playwright/test';
import { chooseMuiOption } from './helpers';

test.describe('species biomes CRUD', () => {
  test('creates, edits, and deletes a species-biome relation through the live UI', async ({ page }) => {
    await page.context().setExtraHTTPHeaders({ 'X-Roles': 'taxonomy:write' });

    const initialNotes = 'Relazione specie-bioma Playwright.';
    const updatedNotes = 'Relazione specie-bioma Playwright aggiornata.';

    await page.goto('/species-biomes');

    await expect(page.getByRole('heading', { name: 'Relazioni specie-biomi' })).toBeVisible();
    await page.getByRole('button', { name: 'Nuova relazione specie-bioma' }).click();

    const createDialog = page.getByRole('dialog');
    await chooseMuiOption(createDialog, 'Specie', 'Emys orbicularis');
    await chooseMuiOption(createDialog, 'Bioma', 'Foresta temperata mista');
    await chooseMuiOption(createDialog, 'Presenza', 'resident');
    await createDialog.getByLabel('Abbondanza').fill('0.22');
    await createDialog.getByLabel('Note').fill(initialNotes);
    await createDialog.getByRole('button', { name: 'Salva' }).click();

    await expect(page.getByText('Relazione specie-bioma creata con successo.')).toBeVisible();

    const createdRow = page.locator('tr', { has: page.getByRole('cell', { name: 'Emys orbicularis' }) }).filter({
      has: page.getByRole('cell', { name: 'Foresta temperata mista' }),
    });
    await createdRow.getByRole('button', { name: 'Azioni' }).click();
    await page.getByRole('menuitem', { name: 'Modifica' }).click();

    const editDialog = page.getByRole('dialog');
    await chooseMuiOption(editDialog, 'Presenza', 'migrant');
    await editDialog.getByLabel('Abbondanza').fill('0.35');
    await editDialog.getByLabel('Note').fill(updatedNotes);
    await editDialog.getByRole('button', { name: 'Salva modifiche' }).click();

    await expect(page.getByText('Relazione specie-bioma aggiornata con successo.')).toBeVisible();

    const updatedRow = page.locator('tr', { has: page.getByRole('cell', { name: 'Emys orbicularis' }) }).filter({
      has: page.getByRole('cell', { name: 'Foresta temperata mista' }),
    });
    await updatedRow.getByRole('button', { name: 'Azioni' }).click();
    await page.getByRole('menuitem', { name: 'Elimina' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Elimina' }).click();

    await expect(page.getByText('Relazione specie-bioma eliminata con successo.')).toBeVisible();
  });
});

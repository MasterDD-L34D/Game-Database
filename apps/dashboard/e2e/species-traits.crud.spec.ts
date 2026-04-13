import { expect, test } from '@playwright/test';
import { chooseMuiOption } from './helpers';

test.describe('species traits CRUD', () => {
  test('creates, edits, and deletes a species-trait relation through the live UI', async ({ page }) => {
    await page.context().setExtraHTTPHeaders({ 'X-Roles': 'taxonomy:write' });

    const suffix = Date.now().toString().slice(-6);
    const category = `playwright-${suffix}`;
    const updatedCategory = `playwright-${suffix}-updated`;
    const initialText = `Relazione Playwright ${suffix}`;
    const updatedText = `Relazione Playwright ${suffix} aggiornata`;

    await page.goto('/species-traits');

    await expect(page.getByRole('heading', { name: 'Relazioni specie-trait' })).toBeVisible();
    await page.getByRole('button', { name: 'Nuova relazione specie-trait' }).click();

    const createDialog = page.getByRole('dialog');
    await chooseMuiOption(createDialog, 'Specie', 'Emys orbicularis');
    await chooseMuiOption(createDialog, 'Trait', 'Struttura sociale');
    await createDialog.getByLabel('Categoria').fill(category);
    await createDialog.getByLabel('Testo').fill(initialText);
    await createDialog.getByLabel('Fonte').fill('Playwright source');
    await createDialog.getByRole('button', { name: 'Salva' }).click();

    await expect(page.getByText('Relazione specie-trait creata con successo.')).toBeVisible();
    await expect(page.getByRole('cell', { name: category })).toBeVisible();

    const createdRow = page.locator('tr', { has: page.getByRole('cell', { name: category }) });
    await createdRow.getByRole('button', { name: 'Azioni' }).click();
    await page.getByRole('menuitem', { name: 'Modifica' }).click();

    const editDialog = page.getByRole('dialog');
    await editDialog.getByLabel('Categoria').fill(updatedCategory);
    await editDialog.getByLabel('Testo').fill(updatedText);
    await editDialog.getByRole('button', { name: 'Salva modifiche' }).click();

    await expect(page.getByText('Relazione specie-trait aggiornata con successo.')).toBeVisible();
    await expect(page.getByRole('cell', { name: updatedCategory })).toBeVisible();

    const updatedRow = page.locator('tr', { has: page.getByRole('cell', { name: updatedCategory }) });
    await updatedRow.getByRole('button', { name: 'Azioni' }).click();
    await page.getByRole('menuitem', { name: 'Elimina' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Elimina' }).click();

    await expect(page.getByText('Relazione specie-trait eliminata con successo.')).toBeVisible();
    await expect(page.getByRole('cell', { name: updatedCategory })).toHaveCount(0);
  });
});

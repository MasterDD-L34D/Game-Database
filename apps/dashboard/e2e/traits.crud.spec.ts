import { expect, test } from '@playwright/test';
import { chooseMuiOption } from './helpers';

test.describe('traits CRUD', () => {
  test('creates, edits, and deletes a trait through the live UI', async ({ page }) => {
    await page.context().setExtraHTTPHeaders({ 'X-Roles': 'taxonomy:write' });

    const suffix = Date.now().toString().slice(-6);
    const slug = `playwright-trait-${suffix}`;
    const name = `Playwright Trait ${suffix}`;
    const updatedName = `Playwright Trait ${suffix} Updated`;
    const tableSearch = page.locator('main').getByPlaceholder('Cerca');

    await page.goto('/traits');
    const main = page.getByRole('main');

    await expect(main.getByRole('heading', { name: 'Trait' })).toBeVisible();
    await page.getByRole('button', { name: 'Nuovo trait' }).click();

    const createDialog = page.getByRole('dialog');
    await createDialog.getByLabel('Slug').fill(slug);
    await createDialog.getByLabel('Nome').fill(name);
    await createDialog.getByLabel('Categoria').fill('Playwright');
    await chooseMuiOption(createDialog, 'Tipo dato', 'Testo');
    await createDialog.getByLabel('Descrizione').fill('Trait creato da test Playwright.');
    await createDialog.getByRole('button', { name: 'Salva' }).click();

    await expect(page.getByText('Trait creato con successo.')).toBeVisible();
    await tableSearch.fill(name);
    await expect(page.getByRole('cell', { name })).toBeVisible();

    const createdRow = page.locator('tr', { has: page.getByRole('cell', { name }) });
    await createdRow.getByRole('button', { name: 'Azioni' }).click();
    await page.getByRole('menuitem', { name: 'Modifica' }).click({ force: true });

    const editDialog = page.getByRole('dialog');
    await editDialog.getByLabel('Nome').fill(updatedName);
    await editDialog.getByLabel('Categoria').fill('Playwright Updated');
    await editDialog.getByRole('button', { name: 'Salva modifiche' }).click();

    await expect(page.getByText('Trait aggiornato con successo.')).toBeVisible();
    await tableSearch.fill(updatedName);
    await expect(page.getByRole('cell', { name: updatedName })).toBeVisible();

    const updatedRow = page.locator('tr', { has: page.getByRole('cell', { name: updatedName }) });
    await updatedRow.getByRole('button', { name: 'Azioni' }).click();
    await page.getByRole('menuitem', { name: 'Elimina' }).click({ force: true });

    const deleteDialog = page.getByRole('dialog');
    await deleteDialog.getByRole('button', { name: 'Elimina' }).click();
    await expect(page.getByText('Trait eliminato con successo.')).toBeVisible();
    await tableSearch.fill(updatedName);
    await expect(page.getByRole('cell', { name: updatedName })).toHaveCount(0);
  });
});

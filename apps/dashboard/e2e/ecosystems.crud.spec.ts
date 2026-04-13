import { expect, test } from '@playwright/test';

test.describe('ecosystems CRUD', () => {
  test('creates, edits, and deletes an ecosystem through the live UI', async ({ page }) => {
    await page.context().setExtraHTTPHeaders({
      'X-Roles': 'taxonomy:write',
    });

    const suffix = Date.now().toString().slice(-6);
    const slug = `playwright-ecosystem-${suffix}`;
    const name = `Playwright Ecosystem ${suffix}`;
    const updatedName = `Playwright Ecosystem ${suffix} Updated`;
    const updatedRegion = 'Regione di collaudo';

    await page.goto('/ecosystems');

    await expect(page.getByRole('heading', { name: 'Ecosistemi' })).toBeVisible();
    await page.getByRole('button', { name: 'Nuovo ecosistema' }).click();

    const createDialog = page.getByRole('dialog');
    await expect(createDialog.getByText('Aggiungi ecosistema')).toBeVisible();
    await createDialog.getByLabel('Slug').fill(slug);
    await createDialog.getByLabel('Nome').fill(name);
    await createDialog.getByLabel('Regione').fill('Regione di test');
    await createDialog.getByLabel('Clima').fill('Temperato di test');
    await createDialog.getByLabel('Descrizione').fill('Ecosistema creato da test Playwright end-to-end.');
    await createDialog.getByRole('button', { name: 'Salva' }).click();

    await expect(page.getByText('Ecosistema creato con successo.')).toBeVisible();
    await expect(page.getByRole('cell', { name })).toBeVisible();

    const createdRow = page.locator('tr', { has: page.getByRole('cell', { name }) });
    await createdRow.getByRole('button', { name: 'Azioni' }).click();
    await page.getByRole('menuitem', { name: 'Modifica' }).click();

    const editDialog = page.getByRole('dialog');
    await expect(editDialog.getByText('Modifica ecosistema')).toBeVisible();
    await editDialog.getByLabel('Nome').fill(updatedName);
    await editDialog.getByLabel('Regione').fill(updatedRegion);
    await editDialog.getByLabel('Descrizione').fill('Ecosistema aggiornato da test Playwright end-to-end.');
    await editDialog.getByRole('button', { name: 'Salva modifiche' }).click();

    await expect(page.getByText('Ecosistema aggiornato con successo.')).toBeVisible();
    await expect(page.getByRole('cell', { name: updatedName })).toBeVisible();

    const updatedRow = page.locator('tr', { has: page.getByRole('cell', { name: updatedName }) });
    await updatedRow.getByRole('button', { name: 'Azioni' }).click();
    await page.getByRole('menuitem', { name: 'Elimina' }).click();

    const deleteDialog = page.getByRole('dialog');
    await expect(deleteDialog.getByText('Elimina ecosistema')).toBeVisible();
    await deleteDialog.getByRole('button', { name: 'Elimina' }).click();

    await expect(page.getByText('Ecosistema eliminato con successo.')).toBeVisible();
    await expect(page.getByRole('cell', { name: updatedName })).toHaveCount(0);
  });
});

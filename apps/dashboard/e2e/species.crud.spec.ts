import { expect, test } from '@playwright/test';

test.describe('species CRUD', () => {
  test('creates, edits, and deletes a species through the live UI', async ({ page }) => {
    await page.context().setExtraHTTPHeaders({
      'X-Roles': 'taxonomy:write',
    });

    const suffix = Date.now().toString().slice(-6);
    const slug = `playwright-species-${suffix}`;
    const scientificName = `Playwright species ${suffix}`;
    const updatedScientificName = `Playwright species ${suffix} updated`;
    const updatedStatus = 'QA';

    await page.goto('/species');
    const main = page.getByRole('main');

    await expect(main.getByRole('heading', { name: 'Specie' })).toBeVisible();
    await page.getByRole('button', { name: 'Nuova specie' }).click();

    const createDialog = page.getByRole('dialog');
    await expect(createDialog.getByText('Aggiungi specie')).toBeVisible();
    await createDialog.getByLabel('Slug').fill(slug);
    await createDialog.getByLabel('Nome scientifico').fill(scientificName);
    await createDialog.getByLabel('Nome comune').fill(`Specie comune ${suffix}`);
    await createDialog.getByLabel('Regno').fill('Animalia');
    await createDialog.getByLabel('Phylum').fill('Chordata');
    await createDialog.getByLabel('Classe').fill('Aves');
    await createDialog.getByLabel('Ordine').fill('Passeriformes');
    await createDialog.getByLabel('Famiglia').fill('Playwrightidae');
    await createDialog.getByLabel('Genere').fill('Playwrightus');
    await createDialog.getByLabel('Epiteto').fill(`spec-${suffix}`);
    await createDialog.getByLabel('Stato').fill('TEST');
    await createDialog.getByLabel('Descrizione').fill('Specie creata da test Playwright end-to-end.');
    await createDialog.getByRole('button', { name: 'Salva' }).click();

    await expect(page.getByText('Specie creata con successo.')).toBeVisible();
    await expect(page.getByRole('cell', { name: scientificName })).toBeVisible();

    const createdRow = page.locator('tr', { has: page.getByRole('cell', { name: scientificName }) });
    await createdRow.getByRole('button', { name: 'Azioni' }).click();
    await page.getByRole('menuitem', { name: 'Modifica' }).click();

    const editDialog = page.getByRole('dialog');
    await expect(editDialog.getByText('Modifica specie')).toBeVisible();
    await editDialog.getByLabel('Nome scientifico').fill(updatedScientificName);
    await editDialog.getByLabel('Stato').fill(updatedStatus);
    await editDialog.getByLabel('Descrizione').fill('Specie aggiornata da test Playwright end-to-end.');
    await editDialog.getByRole('button', { name: 'Salva modifiche' }).click();

    await expect(page.getByText('Specie aggiornata con successo.')).toBeVisible();
    await expect(page.getByRole('cell', { name: updatedScientificName })).toBeVisible();

    const updatedRow = page.locator('tr', { has: page.getByRole('cell', { name: updatedScientificName }) });
    await updatedRow.getByRole('button', { name: 'Azioni' }).click();
    await page.getByRole('menuitem', { name: 'Elimina' }).click();

    const deleteDialog = page.getByRole('dialog');
    await expect(deleteDialog.getByText('Elimina specie')).toBeVisible();
    await deleteDialog.getByRole('button', { name: 'Elimina' }).click();

    await expect(page.getByText('Specie eliminata con successo.')).toBeVisible();
    await expect(page.getByRole('cell', { name: updatedScientificName })).toHaveCount(0);
  });
});

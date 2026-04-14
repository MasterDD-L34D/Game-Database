import { expect, test } from '@playwright/test';
import { chooseMuiOption } from './helpers';

test.describe('taxonomy consultation navigation', () => {
  test('navigates from species detail to a related trait and back to a related species', async ({ page }) => {
    await page.context().setExtraHTTPHeaders({ 'X-Roles': 'taxonomy:write' });

    const suffix = Date.now().toString().slice(-6);
    const category = `consult-nav-${suffix}`;
    const updatedCategory = `consult-nav-${suffix}-done`;

    await page.goto('/species-traits');
    await expect(page.getByRole('heading', { name: 'Relazioni specie-trait' })).toBeVisible();

    await page.getByRole('button', { name: 'Nuova relazione specie-trait' }).click();
    const createDialog = page.getByRole('dialog');
    await chooseMuiOption(createDialog, 'Specie', 'Emys orbicularis');
    await chooseMuiOption(createDialog, 'Trait', 'Struttura sociale');
    await createDialog.getByLabel('Categoria').fill(category);
    await createDialog.getByLabel('Testo').fill(`Navigation setup ${suffix}`);
    await createDialog.getByRole('button', { name: 'Salva' }).click();
    await expect(page.getByText('Relazione specie-trait creata con successo.')).toBeVisible();
    await expect(page.getByRole('cell', { name: category })).toBeVisible();

    await page.goto('/species');
    const tableSearch = page.locator('main').getByPlaceholder('Cerca');
    await tableSearch.fill('Emys orbicularis');

    const speciesLink = page.getByRole('link', { name: 'Emys orbicularis' }).first();
    await expect(speciesLink).toBeVisible();
    await speciesLink.click();

    await expect(page).toHaveURL(/\/species\/.+/);
    await expect(page.getByRole('heading', { name: 'Emys orbicularis' })).toBeVisible();

    const relatedTraitLink = page.getByRole('link', { name: 'Struttura sociale' }).first();
    await expect(relatedTraitLink).toBeVisible();
    await relatedTraitLink.click();

    await expect(page).toHaveURL(/\/traits\/.+/);

    const relatedSpeciesLink = page.getByRole('link', { name: 'Emys orbicularis' }).first();
    await expect(relatedSpeciesLink).toBeVisible();
    await relatedSpeciesLink.click();
    await expect(page).toHaveURL(/\/species\/.+/);

    await page.goto('/species-traits');
    const relationRow = page.locator('tr', { has: page.getByRole('cell', { name: category }) });
    await relationRow.getByRole('button', { name: 'Azioni' }).click();
    await page.getByRole('menuitem', { name: 'Modifica' }).click();

    const editDialog = page.getByRole('dialog');
    await editDialog.getByLabel('Categoria').fill(updatedCategory);
    await editDialog.getByRole('button', { name: 'Salva modifiche' }).click();
    await expect(page.getByText('Relazione specie-trait aggiornata con successo.')).toBeVisible();

    const updatedRow = page.locator('tr', { has: page.getByRole('cell', { name: updatedCategory }) });
    await updatedRow.getByRole('button', { name: 'Azioni' }).click();
    await page.getByRole('menuitem', { name: 'Elimina' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Elimina' }).click();
    await expect(page.getByText('Relazione specie-trait eliminata con successo.')).toBeVisible();
  });
});

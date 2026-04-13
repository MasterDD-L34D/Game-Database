import { expect, test } from '@playwright/test';
import { chooseMuiOption } from './helpers';

test.describe('ecosystem species CRUD', () => {
  test('creates, edits, and deletes an ecosystem-species relation through the live UI', async ({ page }) => {
    await page.context().setExtraHTTPHeaders({ 'X-Roles': 'taxonomy:write' });

    await page.goto('/ecosystem-species');

    await expect(page.getByRole('heading', { name: 'Relazioni ecosistemi-specie' })).toBeVisible();
    await page.getByRole('button', { name: 'Nuova relazione ecosistema-specie' }).click();

    const createDialog = page.getByRole('dialog');
    await chooseMuiOption(createDialog, 'Ecosistema', 'Delta mediterraneo');
    await chooseMuiOption(createDialog, 'Specie', 'Falco peregrinus');
    await chooseMuiOption(createDialog, 'Ruolo', 'other');
    await createDialog.getByLabel('Abbondanza').fill('0.12');
    await createDialog.getByLabel('Note').fill('Relazione ecosistema-specie Playwright.');
    await createDialog.getByRole('button', { name: 'Salva' }).click();

    await expect(page.getByText('Relazione ecosistema-specie creata con successo.')).toBeVisible();

    const createdRow = page.locator('tr', { has: page.getByRole('cell', { name: 'Delta mediterraneo' }) }).filter({
      has: page.getByRole('cell', { name: 'Falco peregrinus' }),
    });
    await createdRow.getByRole('button', { name: 'Azioni' }).click();
    await page.getByRole('menuitem', { name: 'Modifica' }).click();

    const editDialog = page.getByRole('dialog');
    await chooseMuiOption(editDialog, 'Ruolo', 'common');
    await editDialog.getByLabel('Abbondanza').fill('0.19');
    await editDialog.getByLabel('Note').fill('Relazione ecosistema-specie Playwright aggiornata.');
    await editDialog.getByRole('button', { name: 'Salva modifiche' }).click();

    await expect(page.getByText('Relazione ecosistema-specie aggiornata con successo.')).toBeVisible();

    const updatedRow = page.locator('tr', { has: page.getByRole('cell', { name: 'Delta mediterraneo' }) }).filter({
      has: page.getByRole('cell', { name: 'Falco peregrinus' }),
    });
    await updatedRow.getByRole('button', { name: 'Azioni' }).click();
    await page.getByRole('menuitem', { name: 'Elimina' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Elimina' }).click();

    await expect(page.getByText('Relazione ecosistema-specie eliminata con successo.')).toBeVisible();
  });
});

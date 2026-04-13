import { expect, test } from '@playwright/test';
import { chooseMuiOption } from './helpers';

test.describe('ecosystem biomes CRUD', () => {
  test('creates, edits, and deletes an ecosystem-biome relation through the live UI', async ({ page }) => {
    await page.context().setExtraHTTPHeaders({ 'X-Roles': 'taxonomy:write' });

    await page.goto('/ecosystem-biomes');

    await expect(page.getByRole('heading', { name: 'Relazioni ecosistemi-biomi' })).toBeVisible();
    await page.getByRole('button', { name: 'Nuova relazione ecosistema-bioma' }).click();

    const createDialog = page.getByRole('dialog');
    await chooseMuiOption(createDialog, 'Ecosistema', 'Parco forestale boreale');
    await chooseMuiOption(createDialog, 'Bioma', 'Zona umida costiera');
    await createDialog.getByLabel('Proporzione').fill('0.18');
    await createDialog.getByLabel('Note').fill('Relazione ecosistema-bioma Playwright.');
    await createDialog.getByRole('button', { name: 'Salva' }).click();

    await expect(page.getByText('Relazione ecosistema-bioma creata con successo.')).toBeVisible();

    const createdRow = page.locator('tr', { has: page.getByRole('cell', { name: 'Parco forestale boreale' }) }).filter({
      has: page.getByRole('cell', { name: 'Zona umida costiera' }),
    });
    await createdRow.getByRole('button', { name: 'Azioni' }).click();
    await page.getByRole('menuitem', { name: 'Modifica' }).click();

    const editDialog = page.getByRole('dialog');
    await editDialog.getByLabel('Proporzione').fill('0.21');
    await editDialog.getByLabel('Note').fill('Relazione ecosistema-bioma Playwright aggiornata.');
    await editDialog.getByRole('button', { name: 'Salva modifiche' }).click();

    await expect(page.getByText('Relazione ecosistema-bioma aggiornata con successo.')).toBeVisible();

    const updatedRow = page.locator('tr', { has: page.getByRole('cell', { name: 'Parco forestale boreale' }) }).filter({
      has: page.getByRole('cell', { name: 'Zona umida costiera' }),
    });
    await updatedRow.getByRole('button', { name: 'Azioni' }).click();
    await page.getByRole('menuitem', { name: 'Elimina' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Elimina' }).click();

    await expect(page.getByText('Relazione ecosistema-bioma eliminata con successo.')).toBeVisible();
  });
});

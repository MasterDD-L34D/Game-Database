import type { Locator, Page } from '@playwright/test';

export async function chooseMuiOption(scope: Page | Locator, label: string, optionName: string) {
  const field = scope.getByLabel(label);
  await field.click();
  const page = typeof (scope as Locator).page === 'function' ? (scope as Locator).page() : (scope as Page);
  await page.getByRole('option', { name: optionName }).click();
}

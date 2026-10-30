import { expect, test } from '@playwright/test';

test('la app carga y muestra la marca HYSKAD', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle('HYSKAD');
  await expect(page.getByRole('img', { name: 'HYSKAD' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'HYSKAD' })).toBeVisible();
});

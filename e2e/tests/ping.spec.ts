import { expect, test } from '@playwright/test';

test('la app carga y el ping llega al backend a través del proxy', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle('HYSKAD');
  await expect(page.getByRole('img', { name: 'HYSKAD' })).toBeVisible();

  await page.getByRole('button', { name: /ping/i }).click();

  await expect(page.getByRole('status')).toContainText('pong');
});

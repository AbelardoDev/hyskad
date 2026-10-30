import { expect, test } from '@playwright/test';

import { sinViolacionesGraves } from '../support/axe';
import { nuevaSesion } from '../support/sesion';

for (const tema of ['light', 'dark'] as const) {
  test.describe(`accesibilidad de compras y proveedores en tema ${tema}`, () => {
    test.use({ colorScheme: tema });

    test('nueva compra con errores y una fila llena', async ({ page }) => {
      await nuevaSesion(page, 'ALMACEN');
      await page.goto('/compras/nueva');
      await page.getByRole('button', { name: 'Registrar compra' }).click();
      await expect(page.getByRole('alert').first()).toBeVisible();
      await sinViolacionesGraves(page);

      await page.getByRole('combobox', { name: 'Producto 1' }).fill('Bujía');
      await page.getByRole('option', { name: /Bujía CR7HSA/ }).click();
      await page.getByLabel('Costo unitario').fill('20000');
      await expect(page.getByRole('status').filter({ hasText: 'costo promedio' })).toBeVisible();
      await sinViolacionesGraves(page);
    });

    test('proveedores y compras', async ({ page }) => {
      await nuevaSesion(page, 'ALMACEN');
      await page.goto('/proveedores');
      await expect(page.getByRole('table')).toContainText('Llantas Sinú');
      await sinViolacionesGraves(page);
      await page.getByRole('row', { name: /Llantas Sinú/ }).click();
      await expect(page.getByRole('heading', { level: 1, name: /Llantas Sinú/ })).toBeVisible();
      await sinViolacionesGraves(page);

      await page.goto('/compras');
      await expect(page.getByRole('heading', { level: 1, name: 'Compras' })).toBeVisible();
      await sinViolacionesGraves(page);
    });
  });
}

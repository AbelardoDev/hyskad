import { expect, test } from '@playwright/test';

import { sinViolacionesGraves } from '../support/axe';
import { cargarStock, crearProducto, venderPorApi } from '../support/datos';
import { nuevaSesion } from '../support/sesion';

for (const tema of ['light', 'dark'] as const) {
  test.describe(`accesibilidad de ventas en tema ${tema}`, () => {
    test.use({ colorScheme: tema });

    test('punto de venta con un producto en el carrito y lista de ventas', async ({ page }) => {
      await nuevaSesion(page, 'VENDEDOR');
      await page.goto('/ventas/nueva');
      await page.getByRole('button', { name: 'Atajos' }).click();
      await sinViolacionesGraves(page);

      await page.getByRole('searchbox', { name: /Buscar producto/ }).fill('Bujía');
      await expect(page.getByRole('button', { name: /Bujía CR7HSA/ })).toBeVisible();
      await page.getByRole('searchbox', { name: /Buscar producto/ }).press('Enter');
      await page.getByLabel('Recibido en efectivo').fill('50000');
      await expect(page.getByRole('status').filter({ hasText: 'Cambio' })).toBeVisible();
      await sinViolacionesGraves(page);

      await page.goto('/ventas');
      await expect(page.getByText('Ventas pagadas del periodo')).toBeVisible();
      await sinViolacionesGraves(page);
    });

    test('detalle y comprobante de una venta', async ({ page }) => {
      const producto = await crearProducto(`Axe venta ${Date.now().toString(36)}`);
      await cargarStock(producto.id, 2, 20000);
      const id = await venderPorApi(producto.id);
      await nuevaSesion(page, 'VENDEDOR');

      await page.goto(`/ventas/${id}`);
      await expect(page.getByRole('heading', { level: 1, name: /Venta V-/ })).toBeVisible();
      await sinViolacionesGraves(page);
      await page.goto(`/ventas/${id}/comprobante`);
      await expect(page.getByText('Documento interno. No es factura electrónica.')).toBeVisible();
      await sinViolacionesGraves(page);
    });
  });
}

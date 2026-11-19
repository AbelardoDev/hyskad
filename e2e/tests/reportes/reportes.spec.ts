import { readFile } from 'node:fs/promises';

import { expect, test } from '@playwright/test';

import { cargarStock, crearProducto, venderPorApi } from '../support/datos';
import { nuevaSesion } from '../support/sesion';

test.describe('reportes', () => {
  // CP-132, CP-133
  test('cambia de pestaña y exporta el CSV de ventas con BOM y punto y coma', async ({ page }) => {
    const producto = await crearProducto(`Reporte ${Date.now()}`);
    await cargarStock(producto.id, 5, 30000);
    await venderPorApi(producto.id);
    await nuevaSesion(page);

    await page.goto('/reportes');
    await expect(page).toHaveURL(/\/reportes\/servicios$/);
    await page.getByRole('tab', { name: 'Ventas' }).click();
    await expect(page).toHaveURL(/\/reportes\/ventas$/);
    await expect(page.getByRole('table', { name: 'Detalle de ventas' })).toContainText('Efectivo');

    const [descarga] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Exportar CSV' }).click(),
    ]);
    expect(descarga.suggestedFilename()).toMatch(/^reporte-ventas-\d{4}-\d{2}-\d{2}-a-\d{4}-\d{2}-\d{2}\.csv$/);
    const contenido = await readFile((await descarga.path())!, 'utf8');
    expect(contenido.charCodeAt(0)).toBe(0xfeff);
    expect(contenido).toContain('venta;fecha;vendedor;metodo;total;costo;utilidad');
  });
});

test.describe('en el teléfono @movil', () => {
  // CP-138
  test('dashboard, reportes y paleta sin scroll horizontal', async ({ page }) => {
    await nuevaSesion(page);
    const anchoPagina = () => page.evaluate(() => document.documentElement.scrollWidth);

    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { level: 1, name: /^Hola, / })).toBeVisible();
    await expect.poll(anchoPagina).toBeLessThanOrEqual(375);

    for (const pestana of ['servicios', 'inventario', 'ventas', 'cuentas-pendientes']) {
      await page.goto(`/reportes/${pestana}`);
      await expect(page.getByRole('tab', { selected: true })).toBeVisible();
      await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
      await expect.poll(anchoPagina).toBeLessThanOrEqual(375);
    }

    await page.getByRole('button', { name: 'Buscar clientes, placas, órdenes o productos' }).click();
    const paleta = page.getByRole('dialog', { name: 'Buscar o ir a…' });
    await expect(paleta.getByRole('combobox')).toBeFocused();
    await paleta.getByRole('combobox').fill('inicio');
    await paleta.getByRole('option', { name: 'Inicio' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});

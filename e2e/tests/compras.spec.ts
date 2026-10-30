import { expect, Page, test } from '@playwright/test';

import { crearProducto } from './support/datos';
import { nuevaSesion } from './support/sesion';

const PROVEEDOR = 'Lubricantes y Filtros de Colombia S.A.';

async function elegirProducto(page: Page, fila: number, nombre: string) {
  await page.getByRole('combobox', { name: `Producto ${fila}` }).fill(nombre);
  await page.getByRole('option', { name: new RegExp(nombre) }).click();
}

test.describe('compras a proveedores', () => {
  test('registra una compra de 2 productos y el stock y el costo promedio quedan en la ficha', async ({
    page,
  }) => {
    const sufijo = Date.now().toString(36).toUpperCase();
    const filtro = await crearProducto(`Filtro E2E ${sufijo}`);
    const bujia = await crearProducto(`Bujía E2E ${sufijo}`);
    await nuevaSesion(page, 'ALMACEN');

    await page.goto('/compras');
    await page.getByRole('link', { name: 'Nueva compra' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Nueva compra' })).toBeVisible();
    await page.getByRole('combobox', { name: 'Proveedor' }).fill('Lubricantes');
    await page.getByRole('option', { name: new RegExp(PROVEEDOR) }).click();
    await page.getByLabel('Número de factura').fill(`FE-${sufijo}`);

    await elegirProducto(page, 1, filtro.nombre);
    await page.getByLabel('Cantidad').first().fill('10');
    await page.getByLabel('Costo unitario').first().fill('1000');
    await page.getByRole('button', { name: 'Agregar producto' }).click();
    await elegirProducto(page, 2, bujia.nombre);
    await page.getByLabel('Cantidad').nth(1).fill('4');
    await page.getByLabel('Costo unitario').nth(1).fill('2500');

    // 10 × 1.000 + 4 × 2.500 = 20.000 + IVA 19 % = 23.800
    await expect(page.getByText('$ 23.800')).toBeVisible();
    await page.getByRole('button', { name: 'Registrar compra' }).click();
    const confirmacion = page.getByRole('dialog', { name: '¿Registrar la compra?' });
    await expect(confirmacion).toContainText('2 productos');
    await confirmacion.getByRole('button', { name: 'Registrar compra' }).click();

    await expect(page.getByRole('heading', { level: 1, name: /Compra C-\d{6}/ })).toBeVisible();
    await expect(page.getByText('Registrada', { exact: true })).toBeVisible();

    await page.goto(`/inventario/productos/${filtro.id}`);
    await expect(page.getByRole('heading', { level: 1, name: filtro.nombre })).toBeVisible();
    const existencias = page.locator('dl > div').filter({ hasText: 'Existencias' });
    await expect(existencias).toContainText('10');
    await expect(page.locator('dl > div').filter({ hasText: 'Costo promedio' })).toContainText('$ 1.000');
    await page.getByRole('tab', { name: 'Movimientos' }).click();
    await expect(page.getByText('Entrada por compra')).toBeVisible();

    await page.goto(`/inventario/productos/${bujia.id}`);
    await expect(page.locator('dl > div').filter({ hasText: 'Costo promedio' })).toContainText('$ 2.500');
  });

  test('anula una compra con motivo y avisa si el costo se aleja del promedio', async ({ page }) => {
    const sufijo = Date.now().toString(36).toUpperCase();
    const producto = await crearProducto(`Pastilla E2E ${sufijo}`);
    await nuevaSesion(page, 'ADMIN');

    await page.goto('/compras/nueva');
    await page.getByRole('combobox', { name: 'Proveedor' }).fill('Llantas');
    await page.getByRole('option', { name: /Llantas Sinú/ }).click();
    await page.getByLabel('Número de factura').fill(`FA-${sufijo}`);
    await elegirProducto(page, 1, producto.nombre);
    await page.getByLabel('Cantidad').fill('3');
    await page.getByLabel('Costo unitario').fill('8000');
    await page.getByRole('button', { name: 'Registrar compra' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Registrar compra' }).click();
    await expect(page.getByRole('heading', { level: 1, name: /Compra C-\d{6}/ })).toBeVisible();

    // Segunda compra del mismo producto con un costo muy distinto: aparece el aviso
    await page.goto('/compras/nueva');
    await elegirProducto(page, 1, producto.nombre);
    await page.getByLabel('Costo unitario').fill('12000');
    await expect(page.getByText(/50 % más que el costo promedio/)).toBeVisible();

    await page.goBack();
    await page.getByRole('button', { name: 'Anular compra' }).click();
    const anular = page.getByRole('dialog');
    await anular.getByRole('textbox').fill('Factura repetida por error');
    await anular.getByRole('button', { name: 'Anular compra' }).click();
    await expect(page.getByText(/Anulada el .* por/)).toBeVisible();
    await expect(page.getByText('Factura repetida por error')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Anular compra' })).toHaveCount(0);
  });

  test('crea un proveedor con NIT y lo ve en su ficha', async ({ page }) => {
    await nuevaSesion(page, 'ALMACEN');
    const base = `8${Date.now().toString().slice(-8)}`;
    await page.goto('/proveedores');
    await page.getByRole('button', { name: 'Nuevo proveedor' }).click();
    const drawer = page.getByRole('dialog', { name: 'Nuevo proveedor' });
    await drawer.getByLabel('NIT (sin dígito de verificación)').fill(base);
    await drawer.getByLabel('Razón social').fill(`Repuestos E2E ${base}`);
    await drawer.getByRole('button', { name: 'Guardar' }).click();

    await expect(page.getByRole('heading', { level: 1, name: `Repuestos E2E ${base}` })).toBeVisible();
    await expect(page.getByText(new RegExp(`NIT ${base}-\\d`))).toBeVisible();
    await expect(page.getByText('Todavía no hay compras a este proveedor')).toBeVisible();
  });
});

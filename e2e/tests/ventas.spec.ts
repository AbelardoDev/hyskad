import { expect, test } from '@playwright/test';

import { cargarStock, crearProducto, stockDe } from './support/datos';
import { nuevaSesion } from './support/sesion';

test.describe('ventas de mostrador', () => {
  test('venta en efectivo con cambio → comprobante → anulación como admin → stock restituido', async ({
    page,
    browser,
  }) => {
    const sufijo = Date.now().toString(36).toUpperCase();
    // Precio de venta de los productos E2E: $50.000
    const producto = await crearProducto(`Casco E2E ${sufijo}`);
    await cargarStock(producto.id, 5, 30000);
    await nuevaSesion(page, 'VENDEDOR');

    await page.goto('/ventas/nueva');
    await page.getByRole('searchbox', { name: /Buscar producto/ }).fill(producto.codigo);
    await expect(page.getByRole('button', { name: new RegExp(producto.nombre) })).toBeVisible();
    await page.getByRole('searchbox', { name: /Buscar producto/ }).press('Enter');
    await page.getByLabel('Cantidad 1').fill('2');
    // 2 × 50.000 = 100.000 + IVA 19.000 = 119.000; recibe 120.000 → cambio 1.000
    await page.getByLabel('Recibido en efectivo').fill('120000');
    await expect(page.getByRole('status').filter({ hasText: 'Cambio' })).toContainText('$ 1.000');
    await page.getByRole('button', { name: 'Cobrar' }).click();
    const confirmacion = page.getByRole('dialog', { name: '¿Registrar la venta?' });
    await expect(confirmacion).toContainText('Cambio: $ 1.000');
    await confirmacion.getByRole('button', { name: 'Cobrar' }).click();

    const exito = page.getByRole('heading', { level: 1, name: /Venta V-\d{6} registrada/ });
    await expect(exito).toBeVisible();
    const numero = /V-\d{6}/.exec((await exito.textContent()) ?? '')![0];
    expect(await stockDe(producto.id)).toBe(3);

    await page.getByRole('link', { name: 'Imprimir comprobante' }).click();
    const recibo = page.getByRole('article', { name: `Comprobante de la venta ${numero}` });
    await expect(recibo).toContainText('Taller HYSKAD');
    await expect(recibo).toContainText('NIT 900123456-8');
    await expect(recibo).toContainText(producto.nombre);
    await expect(recibo).toContainText('$ 119.000');
    await expect(recibo).toContainText('Consumidor final');
    await expect(recibo).toContainText('Documento interno. No es factura electrónica.');
    // Fuera del shell: sin menú lateral
    await expect(page.locator('aside nav')).toHaveCount(0);
    await page.getByRole('button', { name: 'Tirilla 80 mm' }).click();
    await expect(page.getByRole('button', { name: 'Tirilla 80 mm' })).toHaveAttribute('aria-pressed', 'true');

    // El vendedor no puede anular (RN-21); el admin sí
    await page.getByRole('link', { name: 'Volver a la venta' }).click();
    await expect(page.getByRole('heading', { level: 1, name: `Venta ${numero}` })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Anular venta' })).toHaveCount(0);

    const contextoAdmin = await browser.newContext();
    const admin = await contextoAdmin.newPage();
    await nuevaSesion(admin, 'ADMIN');
    await admin.goto(page.url());
    await admin.getByRole('button', { name: 'Anular venta' }).click();
    const anular = admin.getByRole('dialog');
    await anular.getByRole('textbox').fill('El cliente devolvió los cascos');
    await anular.getByRole('button', { name: 'Anular venta' }).click();
    await expect(admin.getByText(/Anulada el .* por/)).toBeVisible();
    expect(await stockDe(producto.id)).toBe(5);
    await contextoAdmin.close();
  });

  test('una venta de 3 productos solo con teclado', async ({ page }) => {
    const sufijo = Date.now().toString(36).toUpperCase();
    const productos = await Promise.all(
      ['Guante', 'Gafa', 'Rodillera'].map((n) => crearProducto(`${n} E2E ${sufijo}`)),
    );
    for (const p of productos) await cargarStock(p.id, 4, 10000);
    await nuevaSesion(page, 'VENDEDOR');
    await page.goto('/ventas/nueva');
    await expect(page.getByRole('heading', { level: 1, name: 'Nueva venta' })).toBeVisible();

    await page.keyboard.press('F2');
    const buscador = page.getByRole('searchbox', { name: /Buscar producto/ });
    await expect(buscador).toBeFocused();
    for (const p of productos) {
      await page.keyboard.type(p.codigo);
      await expect(page.getByRole('button', { name: new RegExp(p.nombre) })).toBeVisible();
      await page.keyboard.press('Enter');
      await expect(buscador).toHaveValue('');
      await expect(buscador).toBeFocused();
    }
    await expect(page.getByLabel('Cantidad 3')).toBeVisible();

    // F9 cobra; la confirmación se acepta con Tab + Enter
    await page.keyboard.press('F9');
    const confirmacion = page.getByRole('dialog', { name: '¿Registrar la venta?' });
    await expect(confirmacion).toContainText('3 productos');
    const cobrar = confirmacion.getByRole('button', { name: 'Cobrar' });
    while (!(await cobrar.evaluate((b) => b === document.activeElement))) {
      await page.keyboard.press('Tab');
    }
    await page.keyboard.press('Enter');

    await expect(page.getByRole('heading', { level: 1, name: /Venta V-\d{6} registrada/ })).toBeVisible();
    for (const p of productos) expect(await stockDe(p.id)).toBe(3);
  });

  test('la lista muestra las ventas del día con sus totales y filtra las propias', async ({ page }) => {
    await nuevaSesion(page, 'VENDEDOR');
    await page.goto('/ventas');
    await expect(page.getByRole('heading', { level: 1, name: 'Ventas' })).toBeVisible();
    await expect(page.getByText('Ventas pagadas del periodo')).toBeVisible();
    await page.getByRole('checkbox', { name: 'Solo mis ventas' }).check();
    await expect(page.getByText('No hay ventas con estos filtros')).toBeVisible();
  });
});

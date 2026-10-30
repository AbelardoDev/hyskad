import { expect, test } from '@playwright/test';

import { nuevaSesion } from './support/sesion';

const unico = () => `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`.toUpperCase();

test.describe('catálogo e inventario', () => {
  test('crea un producto, le hace un ajuste de entrada y ve el movimiento y el stock', async ({ page }) => {
    await nuevaSesion(page, 'ALMACEN');
    const codigo = `E2E-${unico()}`;
    const nombre = `Pastillas E2E ${codigo}`;

    await page.goto('/inventario');
    await page.getByRole('button', { name: 'Nuevo producto' }).click();
    const drawer = page.getByRole('dialog', { name: 'Nuevo producto' });
    await drawer.getByLabel('Código').fill(codigo.toLowerCase());
    await drawer.getByLabel('Nombre').fill(nombre);
    await drawer.getByLabel('Categoría').selectOption({ label: 'Frenos' });
    await drawer.getByLabel('Unidad de medida').selectOption('PAR');
    await drawer.getByLabel('Precio de venta').fill('32000');
    await drawer.getByLabel('Stock mínimo').fill('2');
    await drawer.getByRole('button', { name: 'Guardar' }).click();

    // Abre la ficha del producto recién creado, sin existencias
    await expect(page.getByRole('heading', { level: 1, name: nombre })).toBeVisible();
    await expect(page.getByText(`${codigo} · Frenos`)).toBeVisible();
    await expect(page.getByText('Agotado')).toBeVisible();

    await page.getByRole('button', { name: 'Ajustar inventario' }).click();
    const ajuste = page.getByRole('dialog', { name: 'Ajustar inventario' });
    await ajuste.getByLabel('Cantidad').fill('6');
    await ajuste.getByLabel('Costo unitario').fill('21000');
    await ajuste.getByLabel('Motivo').fill('Inventario inicial del producto');
    await expect(ajuste.getByRole('status')).toContainText(/Quedarán\s*6/);
    await ajuste.getByRole('button', { name: 'Registrar ajuste' }).click();
    await expect(ajuste).toBeHidden();
    await expect(page.getByText(`Ajuste de ${nombre} registrado`)).toBeVisible();

    // El badge pasa de "Agotado" a "Disponible" (6 > mínimo 2)
    await expect(page.locator('hk-estado-stock')).toHaveText('Disponible');
    await page.getByRole('tab', { name: 'Movimientos' }).click();
    const linea = page.getByRole('listitem').filter({ hasText: 'Ajuste de entrada' });
    await expect(linea).toContainText('+6');
    await expect(linea).toContainText('Inventario inicial del producto');
    await expect(linea).toContainText('Quedaron 6');

    // También aparece en el listado global de movimientos
    await page.goto('/inventario/movimientos');
    await page.getByRole('combobox', { name: 'Producto' }).fill(codigo);
    await page.getByRole('option', { name: new RegExp(nombre) }).click();
    await expect(page.getByRole('table').getByRole('row')).toHaveCount(2);
    await expect(page.getByRole('table')).toContainText('Ajuste de entrada');
  });

  test('una salida mayor que el disponible no se puede confirmar', async ({ page }) => {
    await nuevaSesion(page, 'ALMACEN');
    await page.goto('/inventario');
    await page.getByRole('button', { name: 'Ajustar inventario' }).click();
    const ajuste = page.getByRole('dialog', { name: 'Ajustar inventario' });
    await ajuste.getByLabel('Producto').fill('ELE-BAT-5L');
    await page.getByRole('option', { name: /Batería 12N5L-BS/ }).click();
    await ajuste.getByLabel('Tipo de ajuste').selectOption('SALIDA');
    await ajuste.getByLabel('Cantidad').fill('999');

    await expect(ajuste.getByText(/La salida supera el disponible/)).toBeVisible();
    await expect(ajuste.getByRole('button', { name: 'Registrar ajuste' })).toBeDisabled();
  });

  test('el mecánico ve productos sin costo y sin acciones de gestión', async ({ page }) => {
    await nuevaSesion(page, 'MECANICO');
    await page.goto('/inventario');
    await expect(page.getByRole('table')).toContainText('Bujía CR7HSA');
    await expect(page.getByRole('button', { name: 'Nuevo producto' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Ajustar inventario' })).toHaveCount(0);

    await page.getByRole('row', { name: /Bujía CR7HSA/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Bujía CR7HSA' })).toBeVisible();
    await expect(page.getByText('Costo promedio')).toHaveCount(0);
    await expect(page.getByRole('tab', { name: 'Movimientos' })).toHaveCount(0);
  });

  test('el contador de stock bajo del menú se ve para almacén', async ({ page }) => {
    await nuevaSesion(page, 'ALMACEN');
    await page.goto('/inventario');
    await expect(page.locator('aside nav').getByText(/productos con stock bajo/)).toHaveCount(1);
  });
});

import AxeBuilder from '@axe-core/playwright';
import { expect, Page, test } from '@playwright/test';

import { nuevaSesion } from '../support/sesion';

const GRAVES = ['serious', 'critical'];

async function sinViolacionesGraves(page: Page) {
  const resultado = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const graves = resultado.violations.filter((v) => GRAVES.includes(v.impact ?? ''));
  expect(graves.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
}

for (const tema of ['light', 'dark'] as const) {
  test.describe(`accesibilidad de inventario en tema ${tema}`, () => {
    test.use({ colorScheme: tema });

    test('/inventario con el drawer de producto y el de ajuste', async ({ page }) => {
      await nuevaSesion(page, 'ALMACEN');
      await page.goto('/inventario');
      await expect(page.getByRole('table')).toContainText('Bujía CR7HSA');
      await sinViolacionesGraves(page);

      await page.getByRole('button', { name: 'Nuevo producto' }).click();
      const drawer = page.getByRole('dialog', { name: 'Nuevo producto' });
      await drawer.getByRole('button', { name: 'Guardar' }).click();
      await expect(drawer.getByRole('alert').first()).toBeVisible();
      await sinViolacionesGraves(page);
      await page.keyboard.press('Escape');

      await page.getByRole('button', { name: 'Ajustar inventario' }).click();
      const ajuste = page.getByRole('dialog', { name: 'Ajustar inventario' });
      await ajuste.getByLabel('Producto').fill('Bujía');
      await page.getByRole('option', { name: /Bujía CR7HSA/ }).click();
      await ajuste.getByLabel('Cantidad').fill('2');
      await expect(ajuste.getByRole('status')).toBeVisible();
      await sinViolacionesGraves(page);
    });

    test('ficha del producto con movimientos y listado global', async ({ page }) => {
      await nuevaSesion(page, 'ALMACEN');
      await page.goto('/inventario');
      await page.getByRole('row', { name: /Bujía CR7HSA/ }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'Bujía CR7HSA' })).toBeVisible();
      await sinViolacionesGraves(page);
      await page.getByRole('tab', { name: 'Movimientos' }).click();
      await expect(page.getByText('Ajuste de entrada').first()).toBeVisible();
      await sinViolacionesGraves(page);

      await page.goto('/inventario/movimientos');
      await expect(page.getByRole('table')).toContainText('Ajuste de entrada');
      await sinViolacionesGraves(page);
    });
  });
}

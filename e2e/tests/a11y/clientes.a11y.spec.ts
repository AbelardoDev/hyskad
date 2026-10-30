import AxeBuilder from '@axe-core/playwright';
import { expect, Page, test } from '@playwright/test';

import { crearClienteConMoto, placaUnica } from '../support/datos';
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
  test.describe(`accesibilidad de clientes y motos en tema ${tema}`, () => {
    test.use({ colorScheme: tema });

    test('/clientes con el drawer de nuevo cliente', async ({ page }) => {
      await nuevaSesion(page, 'VENDEDOR');
      await page.goto('/clientes');
      await expect(page.getByRole('table')).toContainText('Mensajería Rápida del Sinú');
      await sinViolacionesGraves(page);

      await page.getByRole('button', { name: 'Nuevo cliente' }).click();
      const drawer = page.getByRole('dialog', { name: 'Nuevo cliente' });
      await drawer.getByRole('button', { name: 'Guardar' }).click();
      await expect(drawer.getByRole('alert').first()).toBeVisible();
      await sinViolacionesGraves(page);
    });

    test('ficha de cliente y de moto', async ({ page }) => {
      const placa = placaUnica();
      const { clienteId, motoId } = await crearClienteConMoto(`Axe ${placa}`, placa);
      await nuevaSesion(page, 'VENDEDOR');

      await page.goto(`/clientes/${clienteId}`);
      await expect(page.getByRole('link', { name: /Honda CB 190R/ })).toBeVisible();
      await sinViolacionesGraves(page);

      await page.goto(`/motocicletas/${motoId}`);
      await expect(page.getByRole('heading', { level: 1, name: 'Honda CB 190R' })).toBeVisible();
      await sinViolacionesGraves(page);
      await page.getByRole('tab', { name: 'Historial' }).click();
      await expect(page.getByText('Sin servicios registrados')).toBeVisible();
      await sinViolacionesGraves(page);
    });

    test('/motocicletas', async ({ page }) => {
      await nuevaSesion(page, 'VENDEDOR');
      await page.goto('/motocicletas');
      await expect(page.getByRole('table')).toContainText('Yamaha');
      await sinViolacionesGraves(page);
    });
  });
}

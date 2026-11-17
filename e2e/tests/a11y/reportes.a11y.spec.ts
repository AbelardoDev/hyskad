import { expect, test } from '@playwright/test';

import { sinViolacionesGraves } from '../support/axe';
import { nuevaOrdenAsignada, ordenFinalizadaPorApi } from '../support/ordenes';
import { crearUsuario, entrar, nuevaSesion } from '../support/sesion';

for (const tema of ['light', 'dark'] as const) {
  test.describe(`accesibilidad de F11 en tema ${tema}`, () => {
    test.use({ colorScheme: tema });

    test('dashboard, reportes y configuración del admin', async ({ page }) => {
      // Recorre siete pantallas con axe en cada una
      test.slow();
      await ordenFinalizadaPorApi();
      await nuevaSesion(page, 'ADMIN');

      await page.goto('/dashboard');
      await expect(page.locator('hk-stat-card').first()).toBeVisible();
      await sinViolacionesGraves(page);

      await page.goto('/reportes');
      for (const pestana of ['Servicios', 'Inventario', 'Ventas', 'Cuentas pendientes']) {
        await page.getByRole('tab', { name: pestana }).click();
        await expect(page.getByRole('tab', { name: pestana })).toHaveAttribute('aria-selected', 'true');
        await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
        await sinViolacionesGraves(page);
      }

      await page.goto('/configuracion');
      await expect(page.locator('form#form-configuracion')).toBeVisible();
      await sinViolacionesGraves(page);
    });

    test('vista del mecánico en el dashboard', async ({ page }) => {
      const mecanico = await crearUsuario('MECANICO');
      await nuevaOrdenAsignada(mecanico.id);
      await entrar(page, mecanico);

      await page.goto('/dashboard');
      await expect(page.getByRole('link', { name: 'Ir a mis órdenes' })).toBeVisible();
      await sinViolacionesGraves(page);
    });
  });
}

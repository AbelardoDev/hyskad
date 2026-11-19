import { expect, test } from '@playwright/test';

import { sinViolacionesGraves } from '../support/axe';
import { nuevaSesion } from '../support/sesion';

for (const tema of ['light', 'dark'] as const) {
  test.describe(`accesibilidad de acceso y usuarios en tema ${tema}`, () => {
    test.use({ colorScheme: tema });

    // CP-64, CP-87
    test('/login con errores visibles', async ({ page }) => {
      await page.goto('/login');
      await page.getByRole('button', { name: 'Entrar' }).click();
      await expect(page.getByLabel('Correo electrónico')).toBeFocused();
      await sinViolacionesGraves(page);
    });

    // CP-64, CP-87
    test('/usuarios con el drawer de nuevo usuario', async ({ page }) => {
      await nuevaSesion(page);
      await page.goto('/usuarios');
      await expect(page.getByRole('table')).toContainText('admin@hyskad.local');
      await sinViolacionesGraves(page);

      await page.getByRole('button', { name: 'Nuevo usuario' }).click();
      await expect(page.getByRole('dialog', { name: 'Nuevo usuario' })).toBeVisible();
      await sinViolacionesGraves(page);
    });

    // CP-87
    test('/usuarios/:id/permisos', async ({ page }) => {
      await nuevaSesion(page);
      await page.goto('/usuarios/3/permisos');
      await expect(page.getByRole('switch').first()).toBeVisible();
      await sinViolacionesGraves(page);
    });
  });
}

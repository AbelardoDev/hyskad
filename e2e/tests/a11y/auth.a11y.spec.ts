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
  test.describe(`accesibilidad de acceso y usuarios en tema ${tema}`, () => {
    test.use({ colorScheme: tema });

    test('/login con errores visibles', async ({ page }) => {
      await page.goto('/login');
      await page.getByRole('button', { name: 'Entrar' }).click();
      await expect(page.getByLabel('Correo electrónico')).toBeFocused();
      await sinViolacionesGraves(page);
    });

    test('/usuarios con el drawer de nuevo usuario', async ({ page }) => {
      await nuevaSesion(page);
      await page.goto('/usuarios');
      await expect(page.getByRole('table')).toContainText('admin@hyskad.local');
      await sinViolacionesGraves(page);

      await page.getByRole('button', { name: 'Nuevo usuario' }).click();
      await expect(page.getByRole('dialog', { name: 'Nuevo usuario' })).toBeVisible();
      await sinViolacionesGraves(page);
    });

    test('/usuarios/:id/permisos', async ({ page }) => {
      await nuevaSesion(page);
      await page.goto('/usuarios/3/permisos');
      await expect(page.getByRole('switch').first()).toBeVisible();
      await sinViolacionesGraves(page);
    });
  });
}

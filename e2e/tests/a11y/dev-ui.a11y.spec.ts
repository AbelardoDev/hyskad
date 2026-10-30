import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

import { nuevaSesion } from '../support/sesion';

// El shell exige sesión: cada prueba entra con un admin propio (cambiar idioma lo guarda en su cuenta).
test.beforeEach(async ({ page }) => {
  await nuevaSesion(page);
});

const GRAVES = ['serious', 'critical'];

for (const tema of ['light', 'dark'] as const) {
  test.describe(`accesibilidad en tema ${tema}`, () => {
    test.use({ colorScheme: tema });

    for (const ruta of ['/dev/ui', '/clientes']) {
      test(`${ruta} sin violaciones serias ni críticas (WCAG 2.1 AA)`, async ({ page }) => {
        await page.goto(ruta);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        const oscuro = await page.evaluate(() => document.documentElement.classList.contains('dark'));
        expect(oscuro).toBe(tema === 'dark');

        const resultado = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();
        const graves = resultado.violations.filter((v) => GRAVES.includes(v.impact ?? ''));

        expect(graves.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual(
          [],
        );
      });
    }
  });
}

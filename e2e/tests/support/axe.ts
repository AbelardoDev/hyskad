import AxeBuilder from '@axe-core/playwright';
import { expect, Page } from '@playwright/test';

const GRAVES = ['serious', 'critical'];

/**
 * Corre axe (WCAG 2.1 AA) y exige cero violaciones serias o críticas. Antes espera a que terminen
 * las animaciones de entrada (las infinitas, como el skeleton, no): con la opacidad a medias axe
 * calcula mal el contraste.
 */
export async function sinViolacionesGraves(page: Page): Promise<void> {
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .filter((a) => a.effect?.getTiming().iterations !== Infinity)
      .every((a) => a.playState !== 'running'),
  );
  const resultado = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const graves = resultado.violations.filter((v) => GRAVES.includes(v.impact ?? ''));
  expect(graves.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
}

import AxeBuilder from '@axe-core/playwright';
import { expect, Page } from '@playwright/test';

const GRAVES = ['serious', 'critical'];

/**
 * Corre axe (WCAG 2.1 AA) y exige cero violaciones serias o críticas. Antes espera a que terminen
 * las animaciones de entrada (las infinitas, como el skeleton, no): con la opacidad a medias axe
 * calcula mal el contraste. Desde F10 puede llegar una notificación en tiempo real (de otra prueba
 * en paralelo) y su toast entrar durante el análisis; por eso, si hay violaciones, se espera otra
 * vez y se repite una sola vez: una violación real aparece en los dos análisis.
 */
export async function sinViolacionesGraves(page: Page): Promise<void> {
  let graves = await analizar(page);
  if (graves.length > 0) graves = await analizar(page);
  expect(graves).toEqual([]);
}

async function analizar(page: Page): Promise<string[]> {
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .filter((a) => a.effect?.getTiming().iterations !== Infinity)
      .every((a) => a.playState !== 'running'),
  );
  const resultado = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  return resultado.violations
    .filter((v) => GRAVES.includes(v.impact ?? ''))
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
}

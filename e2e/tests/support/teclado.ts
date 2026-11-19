import { expect, Locator, Page } from '@playwright/test';

/**
 * Avanza con Tab hasta que `objetivo` tenga el foco y comprueba que el foco se ve
 * (`:focus-visible`). Falla si no se alcanza: el control no sería operable solo con teclado.
 */
export async function tabularHasta(page: Page, objetivo: Locator, maximo = 40): Promise<void> {
  for (let i = 0; i < maximo; i++) {
    if (await objetivo.evaluate((e) => e === document.activeElement).catch(() => false)) {
      expect(await objetivo.evaluate((e) => e.matches(':focus-visible'))).toBe(true);
      return;
    }
    await page.keyboard.press('Tab');
  }
  throw new Error(`No se alcanzó con Tab en ${maximo} pasos: ${objetivo.toString()}`);
}

import { expect, test } from '@playwright/test';

test.describe('galería /dev/ui', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/dev/ui');
    await expect(page.getByRole('heading', { level: 1, name: 'Kit de interfaz' })).toBeVisible();
  });

  test('alterna el tema y se mantiene tras recargar', async ({ page }) => {
    const html = page.locator('html');
    await expect(html).not.toHaveClass(/dark/);

    await page.getByTestId('tema-dark').click();
    await expect(html).toHaveClass(/dark/);
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#070D1A');
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(7, 13, 26)');

    await page.reload();
    await expect(html).toHaveClass(/dark/);
    await expect(page.getByTestId('tema-dark')).toHaveAttribute('aria-pressed', 'true');

    await page.getByTestId('tema-light').click();
    await expect(html).not.toHaveClass(/dark/);
  });

  test('el tema "Sistema" sigue a prefers-color-scheme', async ({ page }) => {
    await page.getByTestId('tema-system').click();
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(page.locator('html')).toHaveClass(/dark/);
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(page.locator('html')).not.toHaveClass(/dark/);
  });

  test('alterna el idioma, actualiza <html lang> y se mantiene tras recargar', async ({ page }) => {
    await page.getByTestId('idioma-en').click();

    await expect(page.getByRole('heading', { level: 1, name: 'UI kit' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toContainText('Customers');
    await expect(page).toHaveTitle('UI kit · HYSKAD');

    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'UI kit' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    await page.getByTestId('idioma-es').click();
    await expect(page.getByRole('heading', { level: 1, name: 'Kit de interfaz' })).toBeVisible();
  });

  test('el modal atrapa el foco, Escape lo cierra y devuelve el foco', async ({ page }) => {
    // Con teclado: Safari no enfoca los botones al hacer clic, así que no habría foco que devolver.
    const abrir = page.getByRole('button', { name: 'Abrir modal' });
    await abrir.focus();
    await page.keyboard.press('Enter');
    const modal = page.getByRole('dialog', { name: 'Registrar diagnóstico' });
    await expect(modal).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();
    await expect(abrir).toBeFocused();
  });

  test('el formulario muestra errores traducidos al validar', async ({ page }) => {
    await page.getByRole('button', { name: 'Validar formulario' }).click();

    await expect(page.getByLabel('Nombre del cliente')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByText('Este campo es obligatorio').first()).toBeVisible();
  });
});

import { expect, test } from '@playwright/test';

test.describe('shell en escritorio', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('la raíz redirige al inicio con título traducido', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page).toHaveTitle('Inicio · HYSKAD');
    await expect(page.getByRole('heading', { level: 1, name: 'Inicio' })).toBeVisible();
  });

  test('navega por el sidebar y lo colapsa recordando el estado', async ({ page }) => {
    await page.goto('/dashboard');
    const sidebar = page.getByRole('navigation', { name: 'Navegación principal' });

    await sidebar.getByRole('link', { name: 'Clientes' }).click();
    await expect(page).toHaveURL(/\/clientes$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Clientes' })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Clientes' })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('navigation', { name: 'Ruta de navegación' })).toContainText('Clientes');

    await page.getByRole('button', { name: 'Colapsar menú' }).click();
    await expect(page.locator('aside')).toHaveCSS('width', '76px');
    await page.reload();
    await expect(page.locator('aside')).toHaveCSS('width', '76px');
    await expect(page.getByRole('button', { name: 'Expandir menú' })).toBeVisible();
  });

  test('una ruta inexistente muestra la página 404 de marca', async ({ page }) => {
    await page.goto('/no-existe');

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Esta página se salió de la ruta');
    await page.getByRole('link', { name: 'Volver al inicio' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});

test.describe('shell en móvil (375 px)', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true });

  test('navega con el drawer y con la barra inferior, sin scroll horizontal', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('aside')).toBeHidden();

    await page.getByRole('button', { name: 'Abrir menú' }).click();
    const drawer = page.getByRole('dialog', { name: 'Navegación principal' });
    await drawer.getByRole('link', { name: 'Inventario' }).click();
    await expect(drawer).toBeHidden();
    await expect(page).toHaveURL(/\/inventario$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Inventario' })).toBeVisible();

    const barra = page.getByRole('navigation', { name: 'Accesos rápidos' });
    await barra.getByRole('link', { name: 'Ventas' }).click();
    await expect(page).toHaveURL(/\/ventas$/);
    await expect(barra.getByRole('link', { name: 'Ventas' })).toHaveAttribute('aria-current', 'page');

    const desborde = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(desborde).toBe(0);
  });
});

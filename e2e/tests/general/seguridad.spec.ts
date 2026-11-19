import { expect, test } from '@playwright/test';

import { apiComoAdmin, nuevaSesion } from '../support/sesion';

test.describe('seguridad en el navegador', () => {
  // CP-61 (XSS almacenado): un nombre con HTML se muestra como texto y no ejecuta nada
  test('un cliente con <script> y <img onerror> en el nombre se ve como texto', async ({ page }) => {
    const marca = `${Date.now()}`.slice(-6);
    const nombres = `<script>window.__xss=1</script>Xss${marca}`;
    const apellidos = '<img src=x onerror="window.__xss=2">';
    const { api, token } = await apiComoAdmin();
    const creado = await api.post('/api/v1/clientes', {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        tipoDocumento: 'CC',
        numeroDocumento: `7${Date.now()}`.slice(0, 10),
        nombres,
        apellidos,
        telefono: '3001234567',
        aceptaTratamientoDatos: true,
      },
    });
    expect(creado.status()).toBe(201);
    const { id } = (await creado.json()) as { id: number };
    await api.dispose();

    const dialogos: string[] = [];
    page.on('dialog', async (d) => {
      dialogos.push(d.message());
      await d.dismiss();
    });
    await nuevaSesion(page);

    await page.goto('/clientes');
    await page.getByRole('searchbox').fill(`Xss${marca}`);
    await expect(page.getByRole('table')).toContainText(`<script>window.__xss=1</script>Xss${marca}`);

    await page.goto(`/clientes/${id}`);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('<img src=x onerror=');

    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
    expect(await page.locator('main script, main img[src="x"]').count()).toBe(0);
    expect(dialogos).toEqual([]);
  });
});

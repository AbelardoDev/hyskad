import { expect, test } from '@playwright/test';

const email = process.env['PROD_EMAIL'] ?? '';
const password = process.env['PROD_PASSWORD'] ?? '';

// CP-67: la app desplegada carga por HTTPS, entra al dashboard, abre el stream de notificaciones en
// tiempo real y la Content-Security-Policy no bloquea nada de la propia app
test('login, dashboard y notificaciones en producción sin violaciones de CSP', async ({ page }) => {
  test.skip(!email || !password, 'Defina PROD_EMAIL y PROD_PASSWORD');

  const violaciones: string[] = [];
  page.on('console', (mensaje) => {
    if (/Content[- ]Security[- ]Policy|Refused to (load|execute|apply)/i.test(mensaje.text())) {
      violaciones.push(mensaje.text());
    }
  });
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) =>
      console.error(`Content-Security-Policy: ${e.violatedDirective} ${e.blockedURI}`),
    );
  });

  const respuesta = await page.goto('/');
  expect(respuesta?.status()).toBe(200);
  await expect(page).toHaveURL(/\/login/);

  const stream = page.waitForResponse((r) => r.url().includes('/api/v1/notificaciones/stream'));
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByRole('textbox', { name: 'Contraseña', exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();

  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect((await stream).status()).toBe(200);

  // El access token vive solo en memoria
  const almacenado = await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }));
  expect(almacenado).not.toMatch(/eyJ[\w-]+\.[\w-]+\./);

  expect(violaciones).toEqual([]);
});

import { defineConfig, devices } from '@playwright/test';

// Smoke test contra producción (F13, CP-67). No reinicia ninguna base ni crea datos: solo entra con
// un usuario de prueba que luego se desactiva (ver docs/DEPLOY.md).
//   PROD_URL=https://hyskad.tudominio.com PROD_EMAIL=... PROD_PASSWORD=... \
//     npx playwright test -c playwright.produccion.config.ts
// PROD_IGNORAR_TLS=1 solo para probarlo contra el compose de producción en local (autofirmado).
const baseURL = process.env['PROD_URL'];
if (!baseURL) {
  throw new Error('Defina PROD_URL (p. ej. https://hyskad.tudominio.com)');
}

export default defineConfig({
  testDir: './produccion',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL,
    ignoreHTTPSErrors: process.env['PROD_IGNORAR_TLS'] === '1',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'movil-webkit', use: { ...devices['iPhone 13'] } },
  ],
});

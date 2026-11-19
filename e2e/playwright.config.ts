import { defineConfig, devices } from '@playwright/test';

// URL de la app bajo prueba; por defecto el servidor de desarrollo de Angular.
const baseURL = process.env['E2E_BASE_URL'] ?? 'http://localhost:4200';

const ESCRITORIO = { width: 1440, height: 900 };
const MOVIL = { width: 375, height: 812 };

export default defineConfig({
  testDir: './tests',
  // Reinicia la BD del backend (perfil e2e) con los datos semilla.
  globalSetup: './global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  reporter: process.env['CI'] ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  // CP-65: escritorio (1440) en los tres motores; las pruebas marcadas @movil corren en teléfonos
  // emulados (375 px, táctil y UA móvil). CI: Chromium en cada PR y todo en push a main.
  projects: [
    { name: 'chromium', grepInvert: /@movil/, use: { ...devices['Desktop Chrome'], viewport: ESCRITORIO } },
    { name: 'firefox', grepInvert: /@movil/, use: { ...devices['Desktop Firefox'], viewport: ESCRITORIO } },
    { name: 'webkit', grepInvert: /@movil/, use: { ...devices['Desktop Safari'], viewport: ESCRITORIO } },
    { name: 'movil-chromium', grep: /@movil/, use: { ...devices['Pixel 7'], viewport: MOVIL } },
    { name: 'movil-webkit', grep: /@movil/, use: { ...devices['iPhone 13'], viewport: MOVIL } },
  ],
});

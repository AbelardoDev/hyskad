import { expect, test } from '@playwright/test';

import { crearUsuario, entrar, entrarPorFormulario, nuevaSesion } from './support/sesion';

const MAILPIT = process.env['E2E_MAILPIT_URL'] ?? 'http://localhost:8026';

test.describe('sesión', () => {
  test('CP-01: login válido entra al inicio y recargar mantiene la sesión sin guardar el token', async ({
    page,
    context,
  }) => {
    const usuario = await crearUsuario('ADMIN');
    await page.goto('/login');
    await expect(page).toHaveTitle('Iniciar sesión · HYSKAD');

    const login = page.waitForResponse('**/api/v1/auth/login');
    await entrarPorFormulario(page, usuario);
    const { accessToken } = (await (await login).json()) as { accessToken: string };

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Inicio' })).toBeVisible();

    const refresh = (await context.cookies()).find((c) => c.name === 'hk_refresh');
    expect(refresh?.httpOnly).toBe(true);
    expect(refresh?.sameSite).toBe('Strict');

    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Inicio' })).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard$/);

    const almacenado = await page.evaluate(() =>
      JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }),
    );
    expect(almacenado).not.toContain(accessToken);
    expect(almacenado).not.toContain(accessToken.split('.')[2]);
  });

  test('login fallido muestra un mensaje genérico y no entra', async ({ page }) => {
    const usuario = await crearUsuario('VENDEDOR');
    await page.goto('/login');

    await entrarPorFormulario(page, { email: usuario.email, password: 'NoEsLaClave1' });

    await expect(page.getByRole('alert')).toContainText('Correo o contraseña incorrectos');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByLabel(/^Contraseña/)).toHaveValue('');
  });

  test('ante el 429 muestra cuánto esperar y bloquea el botón', async ({ page }) => {
    // CP-03 (el límite real) se prueba en la integración del backend; aquí, la reacción de la UI.
    await page.route('**/api/v1/auth/login', (ruta) =>
      ruta.fulfill({
        status: 429,
        headers: { 'Retry-After': '42', 'Content-Type': 'application/problem+json' },
        body: JSON.stringify({ code: 'DEMASIADAS_SOLICITUDES', status: 429 }),
      }),
    );
    await page.goto('/login');

    await entrarPorFormulario(page, { email: 'alguien@hyskad.test', password: 'Clave12345' });

    await expect(page.getByRole('alert')).toContainText('Demasiados intentos seguidos.');
    await expect(page.getByRole('alert')).toContainText(/Podrás intentarlo de nuevo en 4\d s\./);
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeDisabled();
  });

  test('sin sesión, una ruta protegida pide login y luego vuelve a ella', async ({ page }) => {
    const usuario = await crearUsuario('ADMIN');
    await page.goto('/usuarios');

    await expect(page).toHaveURL(/\/login\?returnUrl=%2Fusuarios$/);
    await entrarPorFormulario(page, usuario);

    await expect(page).toHaveURL(/\/usuarios$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Usuarios' })).toBeVisible();
  });

  test('con sesión iniciada, /login lleva al inicio', async ({ page }) => {
    await nuevaSesion(page, 'VENDEDOR');
    await page.goto('/login');
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('CP-04: una petición con el token vencido se renueva sola y se completa', async ({ page }) => {
    await nuevaSesion(page);
    let primera = true;
    // El backend responde 401 a la primera carga de usuarios, como si el access token hubiera vencido.
    await page.route('**/api/v1/usuarios?*', async (ruta) => {
      if (primera) {
        primera = false;
        await ruta.fulfill({
          status: 401,
          contentType: 'application/problem+json',
          body: JSON.stringify({ code: 'NO_AUTENTICADO', status: 401 }),
        });
      } else {
        await ruta.continue();
      }
    });
    await page.goto('/dashboard');
    const refresh = page.waitForRequest('**/api/v1/auth/refresh');

    await page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('link', { name: 'Usuarios' }).click();

    await refresh;
    await expect(page.getByRole('table')).toContainText('admin@hyskad.local');
    await expect(page).toHaveURL(/\/usuarios$/);
  });

  test('cerrar sesión revoca la cookie: recargar no recupera la sesión', async ({ page }) => {
    const usuario = await nuevaSesion(page, 'ALMACEN');
    await page.goto('/dashboard');

    await page.getByRole('button', { name: 'Menú de usuario' }).click();
    await expect(page.getByRole('menu')).toContainText(usuario.nombre);
    await expect(page.getByRole('menu')).toContainText('Almacén');
    await page.getByRole('menuitem', { name: 'Cerrar sesión' }).click();

    await expect(page).toHaveURL(/\/login$/);
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login\?returnUrl=%2Fdashboard$/);
  });

  test('recuperación de contraseña completa con el enlace del correo (Mailpit)', async ({
    page,
    request,
  }) => {
    const usuario = await crearUsuario('VENDEDOR');
    await page.goto('/login');
    await page.getByRole('link', { name: '¿Olvidaste tu contraseña?' }).click();
    await expect(page).toHaveURL(/\/olvide-password$/);

    await page.getByLabel('Correo electrónico').fill(usuario.email);
    await page.getByRole('button', { name: 'Enviar enlace' }).click();
    await expect(page.getByRole('heading', { name: 'Revisa tu correo' })).toBeVisible();

    let enlace = '';
    await expect
      .poll(
        async () => {
          const busqueda = await request.get(`${MAILPIT}/api/v1/search`, {
            params: { query: `to:"${usuario.email}"` },
          });
          const { messages } = (await busqueda.json()) as { messages: { ID: string }[] };
          if (!messages?.length) return '';
          const mensaje = await request.get(`${MAILPIT}/api/v1/message/${messages[0].ID}`);
          const { Text } = (await mensaje.json()) as { Text: string };
          enlace = /https?:\/\/\S*restablecer-password\?token=[\w-]+/.exec(Text)?.[0] ?? '';
          return enlace;
        },
        { timeout: 15_000 },
      )
      .not.toBe('');

    // El enlace apunta a APP_BASE_URL; se abre la misma ruta en la app bajo prueba.
    const { pathname, search } = new URL(enlace);
    await page.goto(pathname + search);
    await page.getByLabel('Contraseña nueva').fill('NuevaClave2026');
    await expect(page.getByText('Fuerte')).toBeVisible();
    await page.getByLabel('Confirma la contraseña').fill('NuevaClave2026');
    await page.getByRole('button', { name: 'Guardar contraseña' }).click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText('Contraseña actualizada. Ya puedes iniciar sesión.')).toBeVisible();
    await entrarPorFormulario(page, { email: usuario.email, password: 'NuevaClave2026' });
    await expect(page).toHaveURL(/\/dashboard$/);

    // El enlace es de un solo uso.
    await page.goto(pathname + search);
    await page.getByLabel('Contraseña nueva').fill('OtraClave2026');
    await page.getByLabel('Confirma la contraseña').fill('OtraClave2026');
    await page.getByRole('button', { name: 'Guardar contraseña' }).click();
    await expect(page.getByRole('heading', { name: 'El enlace no es válido' })).toBeVisible();
  });
});

test.describe('permisos', () => {
  test('un mecánico no ve "Usuarios" en el menú y por URL llega a la página 403', async ({ page }) => {
    await nuevaSesion(page, 'MECANICO');
    await page.goto('/dashboard');
    const menu = page.getByRole('navigation', { name: 'Navegación principal' });
    await expect(menu.getByRole('link', { name: 'Órdenes de trabajo' })).toBeVisible();
    await expect(menu.getByRole('link', { name: 'Usuarios' })).toHaveCount(0);

    await page.goto('/usuarios');

    await expect(page).toHaveURL(/\/acceso-denegado$/);
    await expect(page.getByRole('heading', { name: 'No tienes permiso para ver esta sección' })).toBeVisible();
  });

  test('CP-09: al retirar VENTAS_CREAR a un vendedor desaparece "Nueva venta"', async ({
    page,
    browser,
  }) => {
    const vendedor = await crearUsuario('VENDEDOR');

    const contextoVendedor = await browser.newContext();
    const paginaVendedor = await contextoVendedor.newPage();
    await entrar(paginaVendedor, vendedor);
    await paginaVendedor.goto('/ventas');
    await expect(paginaVendedor.getByRole('link', { name: 'Nueva venta' })).toBeVisible();

    await nuevaSesion(page, 'ADMIN');
    await page.goto(`/usuarios/${vendedor.id}/permisos`);
    const permiso = page.getByRole('switch', { name: 'Registrar ventas' });
    await expect(permiso).toHaveAttribute('aria-checked', 'true');
    await permiso.click();
    await expect(page.getByText('Retirado')).toBeVisible();
    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(page.getByText(`Permisos de ${vendedor.nombre} actualizados`)).toBeVisible();

    // RN-48: la sesión del vendedor se revocó; vuelve a entrar con los permisos nuevos.
    await paginaVendedor.reload();
    await expect(paginaVendedor).toHaveURL(/\/login/);
    await entrarPorFormulario(paginaVendedor, vendedor);
    await paginaVendedor.goto('/ventas');
    await expect(paginaVendedor.getByRole('heading', { level: 1, name: 'Ventas' })).toBeVisible();
    await expect(paginaVendedor.getByRole('link', { name: 'Nueva venta' })).toHaveCount(0);
    await paginaVendedor.goto('/ventas/nueva');
    await expect(paginaVendedor).toHaveURL(/\/acceso-denegado$/);
    await contextoVendedor.close();
  });
});

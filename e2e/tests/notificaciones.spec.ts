import { Browser, expect, Page, test } from '@playwright/test';

import { sinViolacionesGraves } from './support/axe';
import { crearClienteConMoto, placaUnica } from './support/datos';
import { apiComoAdmin, crearUsuario, entrar, UsuarioE2e } from './support/sesion';

async function sesionAparte(browser: Browser, usuario: UsuarioE2e, opciones = {}): Promise<Page> {
  const contexto = await browser.newContext(opciones);
  const page = await contexto.newPage();
  await entrar(page, usuario);
  return page;
}

/** Orden recibida por la API sin mecánicos; devuelve su id y número. */
async function ordenSinMecanicos(): Promise<{ id: number; numero: string; placa: string }> {
  const placa = placaUnica();
  const cliente = await crearClienteConMoto(`Aviso ${placa}`, placa);
  const { api, token } = await apiComoAdmin();
  const respuesta = await api.post('/api/v1/ordenes-trabajo', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      clienteId: cliente.clienteId,
      motocicletaId: cliente.motoId,
      kilometrajeIngreso: 100,
      motivoIngreso: 'Revisión',
      descripcionProblema: 'Ruido en la cadena',
    },
  });
  expect(respuesta.status()).toBe(201);
  const { id, numero } = (await respuesta.json()) as { id: number; numero: string };
  await api.dispose();
  return { id, numero, placa };
}

test.describe('notificaciones en tiempo real', () => {
  test('CP-52: el vendedor asigna una orden y al mecánico le llega la notificación sin recargar', async ({
    browser,
  }) => {
    const [vendedor, mecanico] = await Promise.all([crearUsuario('VENDEDOR'), crearUsuario('MECANICO')]);
    const orden = await ordenSinMecanicos();

    const taller = await sesionAparte(browser, mecanico);
    // El stream queda abierto antes de la acción del vendedor
    const stream = taller.waitForRequest((r) => r.url().includes('/notificaciones/stream?ticket='));
    await taller.goto('/ordenes/mias');
    await stream;
    const campana = taller.getByRole('button', { name: /^Notificaciones/ });
    await expect(campana).toHaveAccessibleName('Notificaciones');

    const mostrador = await sesionAparte(browser, vendedor);
    await mostrador.goto(`/ordenes/${orden.id}`);
    await mostrador.getByRole('button', { name: 'Mecánicos' }).click();
    const modal = mostrador.getByRole('dialog', { name: `Mecánicos de ${orden.numero}` });
    await modal.getByRole('checkbox', { name: mecanico.nombre }).check();
    await modal.getByRole('button', { name: 'Guardar' }).click();
    const asignado = Date.now();

    await expect(campana).toHaveAccessibleName('Notificaciones, 1 sin leer', { timeout: 2000 });
    expect(Date.now() - asignado).toBeLessThan(2000);
    // Toast discreto (región aria-live del kit)
    await expect(taller.locator('[aria-live="polite"]')).toContainText(`Te asignaron la orden ${orden.numero}`);

    await campana.click();
    const panel = taller.getByRole('dialog', { name: 'Notificaciones' });
    await expect(panel).toContainText(`Te asignaron la orden ${orden.numero}`);
    await expect(panel).toContainText(orden.placa);
    await sinViolacionesGraves(taller);
    await panel.getByRole('button', { name: new RegExp(`Te asignaron la orden ${orden.numero}`) }).click();
    await expect(taller).toHaveURL(new RegExp(`/ordenes/${orden.id}$`));
    await expect(campana).toHaveAccessibleName('Notificaciones');

    await taller.context().close();
    await mostrador.context().close();
  });

  test('la página de notificaciones filtra las no leídas y marca todas', async ({ browser }) => {
    const mecanico = await crearUsuario('MECANICO');
    const orden = await ordenSinMecanicos();
    const { api, token } = await apiComoAdmin();
    const headers = { Authorization: `Bearer ${token}` };
    const actual = (await (await api.get(`/api/v1/ordenes-trabajo/${orden.id}`, { headers })).json()) as {
      version: number;
    };
    const asignar = await api.put(`/api/v1/ordenes-trabajo/${orden.id}/mecanicos`, {
      headers,
      data: { version: actual.version, mecanicos: [{ mecanicoId: mecanico.id }] },
    });
    expect(asignar.ok()).toBe(true);
    await api.dispose();

    const page = await sesionAparte(browser, mecanico);
    await page.goto('/notificaciones');
    await expect(page.getByRole('heading', { level: 1, name: 'Notificaciones' })).toBeVisible();
    await expect(page.getByRole('main')).toContainText(`Te asignaron la orden ${orden.numero}`);
    await sinViolacionesGraves(page);

    await page.getByRole('button', { name: 'Marcar todas como leídas' }).click();
    await page.getByRole('main').getByRole('button', { name: 'No leídas', exact: true }).click();
    await expect(page.getByText('No tienes notificaciones sin leer')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Notificaciones/ })).toHaveAccessibleName('Notificaciones');
    await page.context().close();
  });

  test('auditoría: el admin ve la historia de una orden desde su detalle', async ({ browser }) => {
    const admin = await crearUsuario('ADMIN');
    const orden = await ordenSinMecanicos();
    const page = await sesionAparte(browser, admin);

    await page.goto(`/ordenes/${orden.id}`);
    await page.getByRole('link', { name: 'Ver auditoría' }).click();
    await expect(page).toHaveURL(/\/auditoria\?entidad=orden_trabajo&entidadId=\d+$/);
    await expect(page.getByRole('status')).toContainText(`Historia de Orden de trabajo #${orden.id}`);
    const fila = page.getByRole('row').filter({ hasText: 'ORDEN_CREADA' });
    await expect(fila).toBeVisible();
    await sinViolacionesGraves(page);

    await fila.click();
    const panel = page.getByRole('dialog', { name: 'ORDEN_CREADA' });
    await expect(panel).toContainText('numero');
    await expect(panel).toContainText(orden.numero);
    await sinViolacionesGraves(page);
    await page.keyboard.press('Escape');

    await page.getByRole('button', { name: 'Ver toda la auditoría' }).click();
    await expect(page).toHaveURL(/\/auditoria$/);
    await expect(page.getByRole('combobox', { name: 'Usuario' })).toBeVisible();
    await page.context().close();

    const vendedor = await sesionAparte(browser, await crearUsuario('VENDEDOR'));
    await vendedor.goto(`/ordenes/${orden.id}`);
    await expect(vendedor.getByRole('heading', { level: 1, name: /Orden OT-/ })).toBeVisible();
    await expect(vendedor.getByRole('link', { name: 'Ver auditoría' })).toHaveCount(0);
    await vendedor.goto('/auditoria');
    await expect(vendedor).toHaveURL(/\/acceso-denegado$/);
    await vendedor.context().close();
  });
});

for (const tema of ['light', 'dark'] as const) {
  test(`accesibilidad del panel de la campana en tema ${tema}`, async ({ browser }) => {
    const mecanico = await crearUsuario('MECANICO');
    const page = await sesionAparte(browser, mecanico, { colorScheme: tema });
    await page.goto('/ordenes/mias');
    await page.getByRole('button', { name: /^Notificaciones/ }).click();
    await expect(page.getByRole('dialog', { name: 'Notificaciones' })).toBeVisible();
    await sinViolacionesGraves(page);
    await page.context().close();
  });
}

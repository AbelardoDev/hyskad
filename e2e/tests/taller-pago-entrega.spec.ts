import { Browser, expect, Page, test } from '@playwright/test';

import { crearClienteConMoto, placaUnica } from './support/datos';
import { nuevaOrdenAsignada, ordenFinalizadaPorApi } from './support/ordenes';
import { crearUsuario, entrar, UsuarioE2e } from './support/sesion';

const MOVIL = { width: 375, height: 812 };

/** Página nueva con la sesión del usuario en su propio contexto (no comparte cookies). */
async function sesionAparte(browser: Browser, usuario: UsuarioE2e, movil = false): Promise<Page> {
  const contexto = await browser.newContext(movil ? { viewport: MOVIL, hasTouch: true } : {});
  const page = await contexto.newPage();
  await entrar(page, usuario);
  return page;
}

/** Access token de la sesión del navegador (el refresh token va en su cookie). */
async function token(page: Page): Promise<string> {
  const respuesta = await page.request.post('/api/v1/auth/refresh');
  expect(respuesta.ok()).toBe(true);
  return ((await respuesta.json()) as { accessToken: string }).accessToken;
}

test.describe('pago, entrega y vista del mecánico', () => {
  test('CP-50: recepción → diagnóstico → presupuesto → aprobación → reparación → finalización → pago → entrega con 3 usuarios', async ({
    browser,
  }) => {
    test.slow();
    const placa = placaUnica();
    const cliente = await crearClienteConMoto(`Flujo ${placa}`, placa);
    const [recepcionista, mecanico, cajero] = await Promise.all([
      crearUsuario('VENDEDOR'),
      crearUsuario('MECANICO'),
      crearUsuario('VENDEDOR'),
    ]);

    // 1. El vendedor recibe la moto y asigna al mecánico
    const recepcion = await sesionAparte(browser, recepcionista);
    const creada = await recepcion.request.post('/api/v1/ordenes-trabajo', {
      headers: { Authorization: `Bearer ${await token(recepcion)}` },
      data: {
        clienteId: cliente.clienteId,
        motocicletaId: cliente.motoId,
        kilometrajeIngreso: 12000,
        motivoIngreso: 'Frenos y cadena',
        descripcionProblema: 'Frena largo y suena la cadena',
        mecanicos: [{ mecanicoId: mecanico.id }],
      },
    });
    expect(creada.status()).toBe(201);
    const { id, numero } = (await creada.json()) as { id: number; numero: string };
    await recepcion.context().close();

    // 2. El mecánico, en el celular, empieza en "Mis órdenes", diagnostica y agrega el servicio
    const taller = await sesionAparte(browser, mecanico, true);
    await taller.goto('/');
    await expect(taller).toHaveURL(/\/ordenes\/mias$/);
    const porDiagnosticar = taller.getByRole('region', { name: /Por diagnosticar/ });
    await expect(porDiagnosticar).toContainText(numero);
    await porDiagnosticar.getByRole('link', { name: new RegExp(numero) }).click();
    await taller.getByRole('button', { name: 'Iniciar diagnóstico' }).click();
    await taller.getByRole('dialog').getByRole('button', { name: 'Iniciar diagnóstico' }).click();
    await expect(taller.locator('hk-status-badge').first()).toHaveText('En diagnóstico');
    await taller.getByRole('textbox', { name: 'Diagnóstico', exact: true }).fill('Pastillas gastadas');
    await taller.getByRole('button', { name: 'Guardar diagnóstico' }).click();
    await expect(taller.getByText('Diagnóstico guardado')).toBeVisible();
    await taller.getByRole('tab', { name: /Servicios y repuestos/ }).click();
    await taller.getByRole('button', { name: 'Agregar servicio' }).click();
    const servicio = taller.getByRole('dialog', { name: 'Agregar servicio' });
    await servicio.getByRole('combobox', { name: 'Servicio' }).fill('Mantenimiento de frenos');
    await taller.getByRole('option', { name: 'Mantenimiento de frenos' }).click();
    await servicio.getByRole('button', { name: 'Agregar' }).click();
    await expect(servicio).toBeHidden();

    // 3. Otro vendedor envía el presupuesto y registra la aprobación del cliente
    const caja = await sesionAparte(browser, cajero);
    await caja.goto(`/ordenes/${id}`);
    await caja.getByRole('button', { name: 'Enviar presupuesto' }).first().click();
    await caja.getByRole('dialog', { name: /Enviar presupuesto/ }).getByRole('button', { name: 'Enviar presupuesto' }).click();
    await expect(caja.locator('hk-status-badge').first()).toHaveText('Pendiente de aprobación');
    await caja.getByRole('button', { name: 'Aprobar' }).click();
    await caja.getByRole('dialog').getByRole('button', { name: 'Aprobar' }).click();
    await expect(caja.locator('hk-status-badge').first()).toHaveText('En reparación');

    // 4. El mecánico repara y finaliza desde la barra inferior
    await taller.reload();
    await taller.getByRole('button', { name: 'Finalizar' }).click();
    await taller.getByRole('dialog').getByRole('button', { name: 'Finalizar' }).click();
    await expect(taller.locator('hk-status-badge').first()).toHaveText('Finalizada');
    await expect(taller.getByRole('button', { name: 'Entregar' })).toHaveCount(0);
    await taller.context().close();

    // 5. Caja cobra en efectivo ($45.000 + IVA = $53.550) y entrega
    await caja.reload();
    await caja.getByRole('tab', { name: 'Pago y entrega' }).click();
    await expect(caja.getByRole('region', { name: 'Resumen del cobro' })).toContainText('$ 53.550');
    await caja.getByLabel(/Recibido en efectivo/).fill('60000');
    await expect(caja.getByRole('status').filter({ hasText: 'Cambio' })).toContainText('$ 6.450');
    await caja.getByRole('button', { name: /^Cobrar/ }).click();
    await caja.getByRole('dialog').getByRole('button', { name: 'Registrar pago' }).click();
    await expect(caja.getByText(`Pago de la orden ${numero} registrado`)).toBeVisible();

    await caja.getByLabel(/Observaciones de la entrega/).fill('Se entrega con la cadena lubricada');
    await caja.getByRole('button', { name: 'Registrar entrega' }).click();
    await caja.getByRole('dialog').getByRole('button', { name: 'Registrar entrega' }).click();
    await expect(caja.getByRole('heading', { name: `Orden ${numero} entregada` })).toBeVisible();
    await expect(caja.locator('hk-status-badge').first()).toHaveText('Entregada');

    // 6. Comprobante imprimible y el historial de la moto
    await caja.getByRole('link', { name: 'Imprimir comprobante' }).click();
    const comprobante = caja.getByRole('article', { name: `Comprobante de la orden ${numero}` });
    await expect(comprobante).toContainText('Mantenimiento de frenos');
    await expect(comprobante).toContainText('Pastillas gastadas');
    await expect(comprobante).toContainText(mecanico.nombre);
    await expect(comprobante).toContainText('$ 53.550');
    await expect(comprobante).toContainText('Documento interno. No es factura electrónica.');
    await expect(caja.locator('aside nav')).toHaveCount(0);

    await caja.goto(`/motocicletas/${cliente.motoId}`);
    await caja.getByRole('tab', { name: 'Historial' }).click();
    const entrada = caja.getByRole('button', { name: new RegExp(numero) });
    await entrada.click();
    await expect(caja.getByRole('tabpanel')).toContainText('Mantenimiento de frenos');
    await expect(caja.getByRole('tabpanel')).toContainText('12.000 km');
    await caja.context().close();
  });

  test('CP-51: la vista del mecánico en 375 px no se desborda y sus botones miden al menos 44 px', async ({
    browser,
  }) => {
    const mecanico = await crearUsuario('MECANICO');
    const recibida = await nuevaOrdenAsignada(mecanico.id);
    const taller = await sesionAparte(browser, mecanico, true);

    await taller.goto('/ordenes/mias');
    await expect(taller.getByRole('region', { name: /Por diagnosticar/ })).toBeVisible();
    await expect.poll(() => taller.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);

    await taller.goto(`/ordenes/${recibida}`);
    const accion = taller.getByRole('group', { name: 'Acciones de la orden' }).getByRole('button', {
      name: 'Iniciar diagnóstico',
    });
    await expect(accion).toBeVisible();
    const caja = await accion.boundingBox();
    expect(caja!.height).toBeGreaterThanOrEqual(44);
    // Al alcance del pulgar: en la mitad inferior de la pantalla
    expect(caja!.y).toBeGreaterThan(MOVIL.height / 2);
    expect(await taller.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
    await taller.context().close();
  });

  test('cuentas pendientes lleva directo al pago de la orden', async ({ browser }) => {
    const orden = await ordenFinalizadaPorApi();
    const cajero = await crearUsuario('VENDEDOR');
    const caja = await sesionAparte(browser, cajero);

    await caja.goto('/reportes');
    await expect(caja).toHaveURL(/\/reportes\/cuentas-pendientes$/);
    await expect(caja.getByRole('heading', { level: 1, name: 'Cuentas pendientes' })).toBeVisible();
    const fila = caja.getByRole('row').filter({ hasText: orden.numero });
    await expect(fila).toContainText('0 d');
    await expect(fila).toContainText('$ 119.000');
    await fila.getByRole('link', { name: 'Registrar pago' }).click();

    await expect(caja).toHaveURL(new RegExp(`/ordenes/${orden.id}\\?pestana=pago$`));
    await expect(caja.getByRole('tab', { name: 'Pago y entrega' })).toHaveAttribute('aria-selected', 'true');
    await caja.locator('label').filter({ hasText: 'Transferencia' }).click();
    await caja.getByRole('textbox', { name: 'Referencia del pago' }).fill('TRF-001');
    await caja.getByRole('button', { name: /^Cobrar/ }).click();
    await caja.getByRole('dialog').getByRole('button', { name: 'Registrar pago' }).click();
    await expect(caja.getByText('Pagado en Transferencia')).toBeVisible();

    await caja.goto('/reportes/cuentas-pendientes');
    await expect(caja.getByRole('heading', { level: 1, name: 'Cuentas pendientes' })).toBeVisible();
    await expect(caja.getByRole('row').filter({ hasText: orden.numero })).toHaveCount(0);
    await caja.context().close();
  });
});

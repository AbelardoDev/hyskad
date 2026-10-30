import { expect, test } from '@playwright/test';

import { cargarStock, crearClienteConMoto, crearProducto, placaUnica } from './support/datos';
import { apiComoAdmin, crearUsuario, nuevaSesion } from './support/sesion';

/** Orden recibida por la API, con un mecánico, en diagnóstico y con el diagnóstico registrado. */
async function ordenEnDiagnostico(): Promise<{ id: number; placa: string }> {
  const placa = placaUnica();
  const cliente = await crearClienteConMoto(`Presupuesto ${placa}`, placa);
  const mecanico = await crearUsuario('MECANICO');
  const { api, token } = await apiComoAdmin();
  const headers = { Authorization: `Bearer ${token}` };
  const creada = await api.post('/api/v1/ordenes-trabajo', {
    headers,
    data: {
      clienteId: cliente.clienteId,
      motocicletaId: cliente.motoId,
      kilometrajeIngreso: 8000,
      motivoIngreso: 'Mantenimiento',
      descripcionProblema: 'Frena largo y suena la cadena',
      mecanicos: [{ mecanicoId: mecanico.id }],
    },
  });
  expect(creada.status()).toBe(201);
  let orden = (await creada.json()) as { id: number; version: number };
  orden = await (
    await api.post(`/api/v1/ordenes-trabajo/${orden.id}/transiciones`, {
      headers,
      data: { version: orden.version, estado: 'EN_DIAGNOSTICO' },
    })
  ).json();
  const diagnostico = await api.put(`/api/v1/ordenes-trabajo/${orden.id}/diagnostico`, {
    headers,
    data: { version: orden.version, diagnostico: 'Pastillas gastadas y cadena estirada' },
  });
  expect(diagnostico.ok()).toBe(true);
  await api.dispose();
  return { id: orden.id, placa };
}

test.describe('ítems y presupuestos de la orden', () => {
  test('1 servicio y 2 repuestos → enviar presupuesto → aprobar → finalizar → stock descontado en inventario', async ({
    page,
  }) => {
    const sufijo = Date.now().toString(36).toUpperCase();
    const pastillas = await crearProducto(`Pastillas E2E ${sufijo}`);
    const cadena = await crearProducto(`Kit cadena E2E ${sufijo}`);
    await cargarStock(pastillas.id, 5, 20000);
    await cargarStock(cadena.id, 3, 60000);
    const orden = await ordenEnDiagnostico();
    await nuevaSesion(page, 'VENDEDOR');

    await page.goto(`/ordenes/${orden.id}`);
    await page.getByRole('tab', { name: /Servicios y repuestos/ }).click();

    // Servicio del catálogo con el precio sugerido
    await page.getByRole('button', { name: 'Agregar servicio' }).click();
    const servicio = page.getByRole('dialog', { name: 'Agregar servicio' });
    await servicio.getByRole('combobox', { name: 'Servicio' }).fill('Mantenimiento de frenos');
    await page.getByRole('option', { name: 'Mantenimiento de frenos' }).click();
    await servicio.getByRole('button', { name: 'Agregar' }).click();
    await expect(page.getByRole('list').filter({ hasText: 'Mantenimiento de frenos' })).toBeVisible();

    // Dos repuestos (precio E2E: $50.000 cada unidad)
    for (const [producto, cantidad] of [
      [pastillas, '2'],
      [cadena, '1'],
    ] as const) {
      await page.getByRole('button', { name: 'Agregar repuesto' }).click();
      const dialogo = page.getByRole('dialog', { name: 'Agregar repuesto' });
      await dialogo.getByRole('combobox', { name: 'Producto' }).fill(producto.codigo);
      await page.getByRole('option', { name: new RegExp(producto.codigo) }).click();
      await expect(dialogo).toContainText('Disponible');
      await dialogo.getByLabel('Cantidad').fill(cantidad);
      await dialogo.getByRole('button', { name: 'Agregar' }).click();
      await expect(dialogo).toBeHidden();
    }
    // 45.000 + 2 × 50.000 + 50.000 = 195.000 + IVA 37.050 = 232.050
    const totales = page.getByRole('complementary', { name: 'Totales de la orden' });
    await expect(totales).toContainText('$ 232.050');

    // Enviar presupuesto desde el encabezado
    await page.getByRole('button', { name: 'Enviar presupuesto' }).first().click();
    const envio = page.getByRole('dialog', { name: /Enviar presupuesto/ });
    await expect(envio).toContainText('$ 232.050');
    await envio.getByRole('button', { name: 'Enviar presupuesto' }).click();
    await expect(page.locator('hk-status-badge').first()).toHaveText('Pendiente de aprobación');

    // Aprobar en la pestaña de presupuestos
    await expect(page.getByRole('tab', { name: 'Presupuestos' })).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('button', { name: 'Aprobar' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Aprobar' }).click();
    await expect(page.locator('hk-status-badge').first()).toHaveText('En reparación');

    // Finalizar: sale del inventario lo reservado
    await page.getByRole('button', { name: 'Finalizar' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Finalizar' }).click();
    await expect(page.locator('hk-status-badge').first()).toHaveText('Finalizada');

    // El vendedor no ajusta inventario, pero sí ve los productos
    for (const [producto, quedan] of [
      [pastillas, '3'],
      [cadena, '2'],
    ] as const) {
      await page.goto(`/inventario/productos/${producto.id}`);
      const existencias = page.locator('dt', { hasText: 'Existencias' }).locator('xpath=following-sibling::dd');
      await expect(existencias).toHaveText(quedan);
      const reservado = page.locator('dt', { hasText: 'Reservado' }).locator('xpath=following-sibling::dd');
      await expect(reservado).toHaveText('0');
    }
  });

  test('el presupuesto se imprime con la leyenda y vuelve a la orden', async ({ page }) => {
    const orden = await ordenEnDiagnostico();
    const { api, token } = await apiComoAdmin();
    const headers = { Authorization: `Bearer ${token}` };
    const actual = (await (await api.get(`/api/v1/ordenes-trabajo/${orden.id}`, { headers })).json()) as {
      version: number;
    };
    const conServicio = (await (
      await api.post(`/api/v1/ordenes-trabajo/${orden.id}/servicios`, {
        headers,
        data: { version: actual.version, descripcion: 'Revisión general', precio: 60000 },
      })
    ).json()) as { version: number };
    const presupuesto = await api.post(`/api/v1/ordenes-trabajo/${orden.id}/presupuestos`, {
      headers,
      data: { version: conServicio.version, descuento: 0 },
    });
    expect(presupuesto.status()).toBe(201);
    const { id, numero } = (await presupuesto.json()) as { id: number; numero: string };
    await api.dispose();

    await nuevaSesion(page, 'VENDEDOR');
    await page.goto(`/presupuestos/${id}`);
    const documento = page.getByRole('article', { name: `Presupuesto ${numero}` });
    await expect(documento).toContainText('Revisión general');
    await expect(documento).toContainText(orden.placa);
    await expect(documento).toContainText('Documento interno. No es factura electrónica.');
    await expect(page.locator('aside nav')).toHaveCount(0);
    await page.getByRole('link', { name: 'Volver a la orden' }).click();
    await expect(page.getByRole('heading', { level: 1, name: /Orden OT-/ })).toBeVisible();
  });
});

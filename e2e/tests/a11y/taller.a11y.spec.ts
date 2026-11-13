import { expect, test } from '@playwright/test';

import { sinViolacionesGraves } from '../support/axe';
import { crearClienteConMoto, placaUnica } from '../support/datos';
import { nuevaOrdenAsignada, ordenFinalizadaPorApi } from '../support/ordenes';
import { apiComoAdmin, crearUsuario, entrar, nuevaSesion } from '../support/sesion';

/** Orden recibida por la API para la moto de un cliente nuevo; devuelve su id. */
async function ordenPorApi(): Promise<number> {
  const placa = placaUnica();
  const cliente = await crearClienteConMoto(`Axe ${placa}`, placa);
  const { api, token } = await apiComoAdmin();
  const respuesta = await api.post('/api/v1/ordenes-trabajo', {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      clienteId: cliente.clienteId,
      motocicletaId: cliente.motoId,
      kilometrajeIngreso: 100,
      motivoIngreso: 'Revisión',
      descripcionProblema: 'Ruido al frenar',
    },
  });
  expect(respuesta.status()).toBe(201);
  const { id } = (await respuesta.json()) as { id: number };
  await api.dispose();
  return id;
}

for (const tema of ['light', 'dark'] as const) {
  test.describe(`accesibilidad del taller en tema ${tema}`, () => {
    test.use({ colorScheme: tema });

    test('tablero (lista y kanban), recepción y servicios', async ({ page }) => {
      await ordenPorApi();
      await nuevaSesion(page, 'ADMIN');
      await page.goto('/ordenes');
      await expect(page.getByRole('table')).toBeVisible();
      await sinViolacionesGraves(page);

      await page.getByRole('button', { name: 'Tablero' }).click();
      await expect(page.getByRole('region', { name: /Recibida/ })).toBeVisible();
      await sinViolacionesGraves(page);

      await page.goto('/ordenes/nueva');
      await expect(page.getByRole('combobox', { name: 'Cliente' })).toBeVisible();
      await sinViolacionesGraves(page);

      await page.goto('/servicios');
      await expect(page.getByText('Cambio de aceite', { exact: true }).first()).toBeVisible();
      await sinViolacionesGraves(page);
    });

    test('detalle de una orden con sus pestañas y la confirmación de cancelar', async ({ page }) => {
      const id = await ordenPorApi();
      await nuevaSesion(page, 'VENDEDOR');
      await page.goto(`/ordenes/${id}`);
      await expect(page.getByRole('heading', { level: 1, name: /Orden OT-/ })).toBeVisible();
      await sinViolacionesGraves(page);

      await page.getByRole('tab', { name: /Historial/ }).click();
      await sinViolacionesGraves(page);

      await page.getByRole('tab', { name: /Servicios y repuestos/ }).click();
      await expect(page.getByRole('complementary', { name: 'Totales de la orden' })).toBeVisible();
      await sinViolacionesGraves(page);

      await page.getByRole('tab', { name: 'Presupuestos' }).click();
      await expect(page.getByText('Todavía no hay presupuestos')).toBeVisible();
      await sinViolacionesGraves(page);

      await page.getByRole('button', { name: 'Cancelar orden' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await sinViolacionesGraves(page);
    });

    test('pago y entrega, comprobante, cuentas pendientes e historial de la moto', async ({ page }) => {
      const orden = await ordenFinalizadaPorApi();
      await nuevaSesion(page, 'VENDEDOR');
      await page.goto('/reportes/cuentas-pendientes');
      await expect(page.getByRole('row').filter({ hasText: orden.numero })).toBeVisible();
      await sinViolacionesGraves(page);

      await page.goto(`/ordenes/${orden.id}?pestana=pago`);
      await expect(page.getByRole('button', { name: /^Cobrar/ })).toBeVisible();
      await sinViolacionesGraves(page);

      await page.getByRole('button', { name: /^Cobrar/ }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Registrar pago' }).click();
      await expect(page.getByRole('button', { name: 'Registrar entrega' })).toBeVisible();
      await sinViolacionesGraves(page);

      await page.goto(`/ordenes/${orden.id}/comprobante`);
      await expect(page.getByRole('article')).toContainText(orden.numero);
      await sinViolacionesGraves(page);

      await page.goto(`/motocicletas/${orden.motoId}`);
      await page.getByRole('tab', { name: 'Historial' }).click();
      await page.getByRole('button', { name: new RegExp(orden.numero) }).click();
      await expect(page.getByRole('tabpanel')).toContainText('Mantenimiento general');
      await sinViolacionesGraves(page);
    });

    test('vista del mecánico en el celular', async ({ browser }) => {
      const mecanico = await crearUsuario('MECANICO');
      const id = await nuevaOrdenAsignada(mecanico.id);
      const contexto = await browser.newContext({ viewport: { width: 375, height: 812 }, colorScheme: tema });
      const movil = await contexto.newPage();
      await entrar(movil, mecanico);
      await movil.goto('/ordenes/mias');
      await expect(movil.getByRole('region', { name: /Por diagnosticar/ })).toBeVisible();
      await sinViolacionesGraves(movil);

      await movil.goto(`/ordenes/${id}`);
      await expect(movil.getByRole('group', { name: 'Acciones de la orden' })).toBeVisible();
      await sinViolacionesGraves(movil);
      await contexto.close();
    });
  });
}

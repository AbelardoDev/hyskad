import { expect, test } from '@playwright/test';

import { sinViolacionesGraves } from '../support/axe';
import { crearClienteConMoto, placaUnica } from '../support/datos';
import { apiComoAdmin, nuevaSesion } from '../support/sesion';

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

      await page.getByRole('button', { name: 'Cancelar orden' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await sinViolacionesGraves(page);
    });
  });
}

import { expect, test } from '@playwright/test';

import { crearClienteConMoto, placaUnica } from './support/datos';
import { crearUsuario, entrar, nuevaSesion } from './support/sesion';

test.describe('órdenes de trabajo', () => {
  test('recepción completa → asignar mecánico → el mecánico ve solo su orden y registra el diagnóstico', async ({
    page,
    browser,
  }) => {
    const placa = placaUnica();
    const cliente = await crearClienteConMoto(`Recibe ${placa}`, placa);
    const mecanico = await crearUsuario('MECANICO');
    await nuevaSesion(page, 'VENDEDOR');

    // 1) Cliente
    await page.goto('/ordenes');
    await page.getByRole('link', { name: 'Recibir moto' }).click();
    await page.getByRole('combobox', { name: 'Cliente' }).fill(`Recibe ${placa}`);
    await page.getByRole('option', { name: new RegExp(cliente.nombreCompleto) }).click();
    await page.getByRole('button', { name: 'Siguiente' }).click();

    // 2) Moto: sin órdenes anteriores no hay lectura de kilometraje
    await expect(page.getByRole('heading', { name: 'Motocicleta' })).toBeFocused();
    await page.getByText('Honda CB 190R').click();
    await expect(page.getByText('No hay lecturas de kilometraje anteriores')).toBeVisible();
    await page.getByRole('button', { name: 'Siguiente' }).click();

    // 3) Datos de ingreso
    await page.getByLabel('Kilometraje de ingreso').fill('15200');
    await page.getByLabel('Motivo de ingreso').fill('Mantenimiento de los 15.000 km');
    await page.getByLabel('Descripción del problema').fill('Suena la cadena al acelerar');
    await page.getByRole('button', { name: 'Siguiente' }).click();

    // 4) Mecánicos
    await page.getByRole('checkbox', { name: mecanico.nombre }).check();
    await page.getByLabel(`Actividad de ${mecanico.nombre}`).fill('Kit de arrastre');
    await page.getByRole('button', { name: 'Siguiente' }).click();

    // 5) Confirmar
    await expect(page.getByText('Suena la cadena al acelerar')).toBeVisible();
    await expect(page.getByText(mecanico.nombre)).toBeVisible();
    await page.getByRole('button', { name: 'Recibir moto' }).click();

    const titulo = page.getByRole('heading', { level: 1, name: /Orden OT-\d{6}/ });
    await expect(titulo).toBeVisible();
    const numero = /OT-\d{6}/.exec((await titulo.textContent()) ?? '')![0];
    await expect(page.locator('hk-status-badge').first()).toHaveText('Recibida');
    await expect(page.getByText('Kit de arrastre')).toBeVisible();

    // Una segunda recepción de la misma moto advierte la orden activa con enlace a ella
    await page.goto('/ordenes/nueva');
    await page.getByRole('combobox', { name: 'Cliente' }).fill(`Recibe ${placa}`);
    await page.getByRole('option', { name: new RegExp(cliente.nombreCompleto) }).click();
    await page.getByRole('button', { name: 'Siguiente' }).click();
    await page.getByText('Honda CB 190R').click();
    await expect(page.getByRole('alert')).toContainText(numero);
    await expect(page.getByRole('link', { name: 'Ver orden' })).toBeVisible();

    // El mecánico solo ve la orden que tiene asignada
    const contexto = await browser.newContext();
    const taller = await contexto.newPage();
    await entrar(taller, mecanico);
    await taller.goto('/ordenes/mias');
    const tarjetas = taller.getByRole('main').getByRole('listitem');
    await expect(tarjetas).toHaveCount(1);
    await expect(tarjetas.first()).toContainText(numero);
    await tarjetas.first().getByRole('link').click();

    await expect(taller.getByRole('heading', { level: 1, name: `Orden ${numero}` })).toBeVisible();
    await expect(taller.getByRole('button', { name: 'Cancelar orden' })).toHaveCount(0);
    await taller.getByRole('button', { name: 'Iniciar diagnóstico' }).click();
    await taller.getByRole('dialog').getByRole('button', { name: 'Iniciar diagnóstico' }).click();
    await expect(taller.locator('hk-status-badge').first()).toHaveText('En diagnóstico');

    await expect(taller.getByRole('tab', { name: 'Diagnóstico' })).toHaveAttribute('aria-selected', 'true');
    await taller.getByRole('textbox', { name: 'Diagnóstico', exact: true }).fill('Cadena estirada y piñón gastado');
    await taller.getByLabel('Kilometraje de inspección').fill('15210');
    await taller.getByRole('button', { name: 'Guardar diagnóstico' }).click();
    await expect(taller.getByText('Diagnóstico guardado')).toBeVisible();

    await taller.getByRole('tab', { name: /Historial/ }).click();
    await expect(taller.getByRole('tabpanel')).toContainText(mecanico.nombre);
    await contexto.close();
  });

  test('el tablero cambia a kanban y conserva los filtros en la URL', async ({ page }) => {
    const placa = placaUnica();
    const cliente = await crearClienteConMoto(`Kanban ${placa}`, placa);
    await nuevaSesion(page, 'VENDEDOR');
    const respuesta = await page.request.post('/api/v1/ordenes-trabajo', {
      data: {
        clienteId: cliente.clienteId,
        motocicletaId: cliente.motoId,
        kilometrajeIngreso: 100,
        motivoIngreso: 'Revisión',
        descripcionProblema: 'No arranca',
      },
      headers: { Authorization: `Bearer ${await token(page)}` },
    });
    expect(respuesta.status()).toBe(201);

    await page.goto('/ordenes');
    await page.getByRole('button', { name: /^Recibida/ }).click();
    await expect(page).toHaveURL(/estado=RECIBIDA/);
    await page.getByRole('button', { name: 'Tablero' }).click();
    await expect(page).toHaveURL(/vista=kanban/);
    await expect(page.getByRole('region', { name: /Recibida/ })).toContainText(cliente.nombreCompleto);

    await page.reload();
    await expect(page.getByRole('button', { name: 'Tablero' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: /^Recibida/ })).toHaveAttribute('aria-pressed', 'true');
  });
});

/** Access token de la sesión del navegador (el refresh token va en su cookie). */
async function token(page: import('@playwright/test').Page): Promise<string> {
  const respuesta = await page.request.post('/api/v1/auth/refresh');
  expect(respuesta.ok()).toBe(true);
  return ((await respuesta.json()) as { accessToken: string }).accessToken;
}

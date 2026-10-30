import { expect, test } from '@playwright/test';

import { crearClienteConMoto, dvNit, nitUnico, placaUnica } from './support/datos';
import { nuevaSesion } from './support/sesion';

test.describe('clientes y motocicletas', () => {
  test('crea un cliente con NIT, le agrega una moto y la encuentra por placa en minúsculas y con guion', async ({
    page,
  }) => {
    await nuevaSesion(page, 'VENDEDOR');
    const nit = nitUnico();
    const placa = placaUnica();
    const razonSocial = `Mensajería E2E ${placa}`;

    await page.goto('/clientes');
    await page.getByRole('button', { name: 'Nuevo cliente' }).click();
    const drawer = page.getByRole('dialog', { name: 'Nuevo cliente' });
    await drawer.getByLabel('Tipo de documento').selectOption('NIT');
    await expect(drawer.getByLabel('Nombres')).toHaveCount(0);
    await drawer.getByLabel('NIT (sin dígito de verificación)').fill(nit);
    await expect(drawer.getByRole('status', { name: `Dígito de verificación: ${dvNit(nit)}` })).toBeVisible();
    await drawer.getByLabel('Razón social').fill(razonSocial);
    await drawer.getByLabel('Teléfono').fill('604 789 1234');
    await drawer.getByRole('checkbox', { name: /autoriza el tratamiento/ }).check();
    await drawer.getByRole('button', { name: 'Guardar' }).click();

    // Al guardar abre la ficha del cliente
    await expect(page.getByRole('heading', { level: 1, name: razonSocial })).toBeVisible();
    await expect(page.getByText(`NIT ${nit}-${dvNit(nit)}`)).toBeVisible();
    await expect(page.getByText('Todavía no tiene motos')).toBeVisible();

    await page.getByRole('button', { name: 'Agregar moto' }).click();
    const formMoto = page.getByRole('dialog', { name: 'Nueva moto' });
    await expect(formMoto).toContainText(razonSocial);
    await formMoto.getByLabel('Placa').fill(placa.toLowerCase());
    await expect(formMoto.getByLabel('Placa')).toHaveValue(placa);
    await formMoto.getByLabel('Marca').fill('Yamaha');
    await formMoto.getByLabel('Modelo').fill('FZ 2.0');
    await formMoto.getByLabel('Año').fill('2023');
    await formMoto.getByRole('button', { name: 'Guardar' }).click();
    await expect(formMoto).toBeHidden();
    await expect(page.getByRole('link', { name: /Yamaha FZ 2\.0/ })).toBeVisible();

    const escrita = `${placa.slice(0, 3)}-${placa.slice(3)}`.toLowerCase();
    await page.goto('/motocicletas');
    await page.getByRole('searchbox', { name: 'Buscar por placa…' }).fill(escrita);
    await expect(page.getByRole('searchbox', { name: 'Buscar por placa…' })).toHaveValue(placa);
    await expect(page.getByRole('table').getByRole('row')).toHaveCount(2);
    await page.getByRole('row', { name: new RegExp(razonSocial) }).click();

    await expect(page.getByRole('heading', { level: 1, name: 'Yamaha FZ 2.0' })).toBeVisible();
    await page.getByRole('tab', { name: 'Historial' }).click();
    await expect(page.getByText('Sin servicios registrados')).toBeVisible();
  });

  test('cambia el propietario de una moto con confirmación', async ({ page }) => {
    const placa = placaUnica();
    const vendedor = await crearClienteConMoto(`Vende ${placa}`, placa);
    const comprador = await crearClienteConMoto(`Compra ${placa}`);
    await nuevaSesion(page, 'VENDEDOR');

    await page.goto(`/motocicletas/${vendedor.motoId}`);
    await expect(page.getByRole('link', { name: new RegExp(vendedor.nombreCompleto) })).toBeVisible();
    await page.getByRole('button', { name: 'Cambiar propietario' }).click();
    const modal = page.getByRole('dialog', { name: 'Cambiar propietario' });
    await modal.getByRole('combobox').fill(`Compra ${placa}`);
    await page.getByRole('option', { name: new RegExp(comprador.nombreCompleto) }).click();
    await expect(modal.getByRole('status')).toContainText(
      `pasará de ${vendedor.nombreCompleto} a ${comprador.nombreCompleto}`,
    );
    await modal.getByRole('button', { name: 'Confirmar cambio' }).click();

    await expect(modal).toBeHidden();
    await expect(page.getByText(`ahora es de ${comprador.nombreCompleto}`)).toBeVisible();
    await page.getByRole('link', { name: new RegExp(comprador.nombreCompleto) }).click();
    await expect(page.getByRole('link', { name: /Honda CB 190R/ })).toBeVisible();
  });

  test('el mecánico consulta clientes sin poder registrarlos y almacén no entra', async ({ page }) => {
    await nuevaSesion(page, 'MECANICO');
    await page.goto('/clientes');
    await expect(page.getByRole('heading', { level: 1, name: 'Clientes' })).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nuevo cliente' })).toHaveCount(0);

    await page.context().clearCookies();
    await nuevaSesion(page, 'ALMACEN');
    await page.goto('/clientes');
    await expect(page).toHaveURL(/\/acceso-denegado$/);
  });
});

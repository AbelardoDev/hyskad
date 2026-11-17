import { expect, test } from '@playwright/test';

import { sinViolacionesGraves } from './support/axe';
import { crearClienteConMoto, placaUnica } from './support/datos';
import { nuevaSesion } from './support/sesion';

test.describe('paleta de comandos', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('Ctrl+K busca una placa y lleva al detalle de la moto [RF29]', async ({ page }) => {
    const placa = placaUnica();
    const { motoId } = await crearClienteConMoto(`Paleta ${placa}`, placa);
    await nuevaSesion(page);
    await page.goto('/dashboard');
    // El atajo lo escucha la topbar: se espera a que el shell esté listo
    await expect(page.getByRole('heading', { level: 1, name: /^Hola, / })).toBeVisible();

    await page.keyboard.press('Control+k');
    const paleta = page.getByRole('dialog', { name: 'Buscar o ir a…' });
    const busqueda = paleta.getByRole('combobox');
    await expect(busqueda).toBeFocused();
    await expect(paleta.getByRole('option', { name: 'Nueva venta' })).toBeVisible();
    await sinViolacionesGraves(page);

    await busqueda.fill(placa.toLowerCase());
    const grupoMotos = paleta.getByRole('group', { name: 'Motocicletas' });
    await expect(grupoMotos.getByRole('option')).toHaveCount(1);
    await expect(grupoMotos.getByRole('option')).toHaveAttribute('aria-selected', 'true');
    await sinViolacionesGraves(page);
    await page.keyboard.press('Enter');

    await expect(page).toHaveURL(new RegExp(`/motocicletas/${motoId}$`));
    await expect(page.getByRole('heading', { level: 1, name: 'Honda CB 190R' })).toBeVisible();
    await expect(paleta).toBeHidden();
  });

  test('el buscador de la topbar abre la paleta y una acción rápida navega', async ({ page }) => {
    await nuevaSesion(page);
    await page.goto('/dashboard');

    await page.getByRole('button', { name: /Buscar…/ }).click();
    const paleta = page.getByRole('dialog', { name: 'Buscar o ir a…' });
    await paleta.getByRole('combobox').fill('recibir');
    await paleta.getByRole('option', { name: 'Recibir moto' }).click();

    await expect(page).toHaveURL(/\/ordenes\/nueva$/);
    await expect(paleta).toBeHidden();
  });
});

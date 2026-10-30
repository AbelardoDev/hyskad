import { expect, test } from '@playwright/test';

import { nuevaSesion, UsuarioE2e } from './support/sesion';

test.describe('administración de usuarios', () => {
  let yo: UsuarioE2e;

  test.beforeEach(async ({ page }) => {
    yo = await nuevaSesion(page, 'ADMIN');
  });

  test('crea un usuario en el drawer, lo encuentra y lo desactiva con confirmación', async ({ page }) => {
    const email = `e2e-ui-${Date.now()}@hyskad.test`;
    await page.goto('/usuarios');
    await expect(page.getByRole('table')).toContainText('admin@hyskad.local');

    await page.getByRole('button', { name: 'Nuevo usuario' }).click();
    const drawer = page.getByRole('dialog', { name: 'Nuevo usuario' });
    await drawer.getByRole('button', { name: 'Guardar' }).click();
    await expect(drawer.getByRole('alert').first()).toHaveText('Este campo es obligatorio');

    await drawer.getByLabel('Nombre').fill('Marta Mecánica E2E');
    await drawer.getByLabel('Correo electrónico').fill(email);
    await drawer.getByLabel('Rol').selectOption('MECANICO');
    await drawer.getByLabel('Contraseña inicial').fill('corta');
    await expect(drawer.getByText('Débil')).toBeVisible();
    await drawer.getByLabel('Contraseña inicial').fill('Mecanica2026');
    await drawer.getByRole('button', { name: 'Guardar' }).click();

    await expect(drawer).toBeHidden();
    await expect(page.getByText('Usuario Marta Mecánica E2E creado')).toBeVisible();

    await page.getByRole('searchbox', { name: 'Buscar por nombre o correo…' }).fill(email);
    const fila = page.getByRole('row', { name: /Marta Mecánica E2E/ });
    await expect(fila).toContainText('Mecánico');
    await expect(fila).toContainText('Activo');

    await fila.getByRole('button', { name: 'Acciones para Marta Mecánica E2E' }).click();
    await page.getByRole('menuitem', { name: 'Desactivar' }).click();
    const confirmacion = page.getByRole('dialog', { name: '¿Desactivar usuario?' });
    await confirmacion.getByRole('button', { name: 'Desactivar' }).click();

    await expect(fila).toContainText('Inactivo');
  });

  test('filtra por rol y no permite cambiar los propios permisos', async ({ page }) => {
    await page.goto('/usuarios');
    await page.getByRole('combobox', { name: 'Rol' }).selectOption('MECANICO');

    await expect(page.getByRole('list', { name: 'Filtros activos' })).toContainText('Mecánico');
    await expect(page.getByRole('table')).toContainText('mecanico@hyskad.local');
    await expect(page.getByRole('table')).not.toContainText('admin@hyskad.local');

    await page.getByRole('combobox', { name: 'Rol' }).selectOption('ADMIN');
    await page.getByRole('searchbox').fill(yo.email);
    const propia = page.getByRole('row', { name: /\(tú\)/ });
    await propia.getByRole('button', { name: /^Acciones para/ }).click();
    await expect(page.getByRole('menuitem', { name: 'Desactivar' })).toHaveCount(0);
    await page.getByRole('menuitem', { name: 'Permisos' }).click();

    await expect(page.getByText('No puedes cambiar tus propios permisos.')).toBeVisible();
    await expect(page.getByRole('switch', { name: 'Gestionar usuarios y permisos' })).toBeDisabled();
  });
});

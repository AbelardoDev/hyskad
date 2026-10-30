import { APIRequestContext, expect, Page, request } from '@playwright/test';

/** Usuarios semilla del perfil e2e (db/dev-data). Contraseña de todos: Hyskad2026. */
export const ADMIN_SEMILLA = { email: 'admin@hyskad.local', password: 'Hyskad2026' };
export const PASSWORD_E2E = 'Clave2026e2e';

export type Rol = 'ADMIN' | 'ALMACEN' | 'VENDEDOR' | 'MECANICO';

export interface UsuarioE2e {
  id: number;
  nombre: string;
  email: string;
  password: string;
  rol: Rol;
}

const baseURL = () => process.env['E2E_BASE_URL'] ?? 'http://localhost:4200';

let contador = 0;
function emailUnico(rol: Rol): string {
  return `e2e-${rol.toLowerCase()}-${Date.now()}-${process.pid}-${++contador}@hyskad.test`;
}

/** Contexto HTTP con sesión del admin semilla, aparte del navegador (no comparte cookies). */
export async function apiComoAdmin(): Promise<{ api: APIRequestContext; token: string }> {
  const api = await request.newContext({ baseURL: baseURL() });
  const respuesta = await api.post('/api/v1/auth/login', { data: ADMIN_SEMILLA });
  expect(respuesta.ok()).toBe(true);
  const { accessToken } = (await respuesta.json()) as { accessToken: string };
  return { api, token: accessToken };
}

/** Crea un usuario nuevo por la API (cada prueba con el suyo: así pueden correr en paralelo). */
export async function crearUsuario(rol: Rol, idioma: 'es' | 'en' = 'es'): Promise<UsuarioE2e> {
  const { api, token } = await apiComoAdmin();
  const nombre = `E2E ${rol} ${String(Date.now()).slice(-5)}${++contador}`;
  const email = emailUnico(rol);
  const respuesta = await api.post('/api/v1/usuarios', {
    headers: { Authorization: `Bearer ${token}` },
    data: { nombre, email, password: PASSWORD_E2E, rol, idioma },
  });
  expect(respuesta.status()).toBe(201);
  const { id } = (await respuesta.json()) as { id: number };
  await api.dispose();
  return { id, nombre, email, password: PASSWORD_E2E, rol };
}

/**
 * Inicia sesión en el navegador por la API: `page.request` comparte las cookies del contexto, así
 * que la app recupera la sesión con la cookie de refresh al cargar (como tras recargar la página).
 */
export async function entrar(page: Page, usuario: { email: string; password: string }): Promise<void> {
  const respuesta = await page.request.post('/api/v1/auth/login', {
    data: { email: usuario.email, password: usuario.password },
  });
  expect(respuesta.ok()).toBe(true);
}

/** Crea un usuario del rol y abre sesión con él en `page`. */
export async function nuevaSesion(page: Page, rol: Rol = 'ADMIN'): Promise<UsuarioE2e> {
  const usuario = await crearUsuario(rol);
  await entrar(page, usuario);
  return usuario;
}

/** Inicia sesión llenando el formulario de login. */
export async function entrarPorFormulario(
  page: Page,
  usuario: { email: string; password: string },
): Promise<void> {
  await page.getByLabel('Correo electrónico').fill(usuario.email);
  await page.getByRole('textbox', { name: 'Contraseña', exact: true }).fill(usuario.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

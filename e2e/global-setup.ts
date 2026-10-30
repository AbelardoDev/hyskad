import { request } from '@playwright/test';

/** Deja la BD del perfil e2e con los datos semilla antes de la corrida (TEST-PLAN §4). */
export default async function globalSetup(): Promise<void> {
  const baseURL = process.env['E2E_BASE_URL'] ?? 'http://localhost:4200';
  const api = await request.newContext({ baseURL });
  const respuesta = await api.post('/api/v1/test/reset');
  if (respuesta.status() !== 204) {
    throw new Error(
      `POST /api/v1/test/reset respondió ${respuesta.status()}: ¿el backend corre con el perfil e2e?`,
    );
  }
  await api.dispose();
}

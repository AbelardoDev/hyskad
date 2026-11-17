// Utilidades compartidas de los escenarios k6 de HYSKAD.
import http from 'k6/http';
import { check, fail } from 'k6';

export const BASE = __ENV.BASE_URL || 'http://localhost:8082';
export const API = `${BASE}/api/v1`;

/** Usuarios semilla del perfil perf (db/dev-data); contraseña de todos: Hyskad2026. */
export const USUARIOS = {
  admin: 'admin@hyskad.local',
  vendedor: 'vendedor@hyskad.local',
};
const PASSWORD = __ENV.PASSWORD || 'Hyskad2026';

/** Inicia sesión y devuelve las cabeceras con el access token. */
export function entrar(email) {
  const r = http.post(`${API}/auth/login`, JSON.stringify({ email, password: PASSWORD }), {
    headers: { 'Content-Type': 'application/json' },
    tags: { operacion: 'login' },
  });
  if (!check(r, { 'login 200': (x) => x.status === 200 })) {
    fail(`login de ${email} respondió ${r.status}: ${r.body}`);
  }
  return {
    Authorization: `Bearer ${r.json('accessToken')}`,
    'Content-Type': 'application/json',
  };
}

/** `aaaa-mm-dd` de hace `dias` días (UTC; suficiente para fijar el periodo de un reporte). */
export function haceDias(dias) {
  return new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10);
}

export function aleatorio(lista) {
  return lista[Math.floor(Math.random() * lista.length)];
}

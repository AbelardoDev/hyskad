// CP-59: 8 usuarios concurrentes durante 5 minutos con las operaciones habituales del taller.
// Umbrales: p95 ≤ 2 s y 0 % de errores. Datos: perfil `perf` (infra/perf/datos-perf.sql).
import http from 'k6/http';
import { check, sleep } from 'k6';

import { aleatorio, API, entrar, USUARIOS } from './comun.js';

export const options = {
  scenarios: {
    operaciones: {
      executor: 'constant-vus',
      vus: 8,
      duration: __ENV.DURACION || '5m',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    // Desglose por operación en el resumen (el criterio es el global)
    'http_req_duration{operacion:login}': ['p(95)<2000'],
    'http_req_duration{operacion:listar_ordenes}': ['p(95)<2000'],
    'http_req_duration{operacion:buscar_ordenes}': ['p(95)<2000'],
    'http_req_duration{operacion:detalle_orden}': ['p(95)<2000'],
    'http_req_duration{operacion:crear_venta}': ['p(95)<2000'],
    'http_req_duration{operacion:agregar_repuesto}': ['p(95)<2000'],
    http_req_failed: ['rate==0'],
    checks: ['rate==1'],
  },
};

/** Una vez: productos para vender y órdenes en diagnóstico donde agregar repuestos. */
export function setup() {
  const cabeceras = entrar(USUARIOS.admin);
  const productos = http
    .get(`${API}/productos?q=PERF&activo=true&size=100`, { headers: cabeceras })
    .json('content')
    .map((p) => p.id);
  const enDiagnostico = http
    .get(`${API}/ordenes-trabajo?estado=EN_DIAGNOSTICO&size=50`, { headers: cabeceras })
    .json('content')
    .map((o) => o.id);
  if (productos.length === 0 || enDiagnostico.length < 8) {
    throw new Error('Faltan datos: ¿se cargó infra/perf/datos-perf.sql?');
  }
  return { productos, enDiagnostico };
}

let cabeceras;

export default function (datos) {
  // Cada usuario virtual inicia sesión al empezar y luego cada 20 iteraciones (sesión de trabajo)
  if (__ITER % 20 === 0) cabeceras = entrar(USUARIOS.vendedor);
  const opciones = (operacion) => ({ headers: cabeceras, tags: { operacion } });

  // Listar el tablero y buscar por placa parcial
  const lista = http.get(`${API}/ordenes-trabajo?page=0&size=20&sort=fechaIngreso,desc`, opciones('listar_ordenes'));
  check(lista, { 'listar órdenes 200': (r) => r.status === 200 });
  const busqueda = http.get(`${API}/ordenes-trabajo?q=XYA${Math.floor(Math.random() * 100)}&size=20`, opciones('buscar_ordenes'));
  check(busqueda, { 'buscar órdenes 200': (r) => r.status === 200 });

  // Ver el detalle de una orden del tablero
  const id = aleatorio(lista.json('content')).id;
  const detalle = http.get(`${API}/ordenes-trabajo/${id}`, opciones('detalle_orden'));
  check(detalle, { 'detalle 200': (r) => r.status === 200 });

  // Registrar una venta de mostrador
  const venta = http.post(
    `${API}/ventas`,
    JSON.stringify({
      items: [{ productoId: aleatorio(datos.productos), cantidad: 1 }],
      descuento: 0,
      metodoPago: 'EFECTIVO',
      montoRecibido: 1000000,
    }),
    opciones('crear_venta'),
  );
  check(venta, { 'venta 201': (r) => r.status === 201 });

  // Agregar un repuesto a "su" orden en diagnóstico (una por usuario virtual: sin conflictos de versión)
  const orden = datos.enDiagnostico[(__VU - 1) % datos.enDiagnostico.length];
  const actual = http.get(`${API}/ordenes-trabajo/${orden}`, opciones('detalle_orden'));
  const repuesto = http.post(
    `${API}/ordenes-trabajo/${orden}/repuestos`,
    JSON.stringify({ version: actual.json('version'), productoId: aleatorio(datos.productos), cantidad: 1 }),
    opciones('agregar_repuesto'),
  );
  check(repuesto, { 'repuesto 2xx': (r) => r.status === 200 || r.status === 201 });

  sleep(1);
}

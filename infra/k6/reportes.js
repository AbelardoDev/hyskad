// CP-60: reportes y dashboard sobre 12 meses de datos (perfil `perf`). Umbral: p95 ≤ 5 s.
import http from 'k6/http';
import { check, sleep } from 'k6';

import { API, entrar, haceDias, USUARIOS } from './comun.js';

export const options = {
  scenarios: {
    reportes: {
      executor: 'constant-vus',
      vus: Number(__ENV.VUS || 4),
      duration: __ENV.DURACION || '2m',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<5000'],
    // Desglose por reporte en el resumen (el criterio es el global)
    'http_req_duration{operacion:reporte_servicios}': ['p(95)<5000'],
    'http_req_duration{operacion:reporte_inventario}': ['p(95)<5000'],
    'http_req_duration{operacion:reporte_ventas}': ['p(95)<5000'],
    'http_req_duration{operacion:reporte_ventas_csv}': ['p(95)<5000'],
    'http_req_duration{operacion:cuentas_pendientes}': ['p(95)<5000'],
    'http_req_duration{operacion:dashboard}': ['p(95)<5000'],
    http_req_failed: ['rate==0'],
    checks: ['rate==1'],
  },
};

let cabeceras;

export default function () {
  if (__ITER === 0) cabeceras = entrar(USUARIOS.admin);
  const anio = `desde=${haceDias(364)}&hasta=${haceDias(0)}`;
  const pedir = (ruta, operacion) => {
    const r = http.get(`${API}${ruta}`, { headers: cabeceras, tags: { operacion } });
    check(r, { [`${operacion} 200`]: (x) => x.status === 200 });
  };

  pedir(`/reportes/servicios?${anio}`, 'reporte_servicios');
  pedir(`/reportes/inventario?${anio}`, 'reporte_inventario');
  pedir(`/reportes/ventas?${anio}`, 'reporte_ventas');
  pedir(`/reportes/ventas?${anio}&formato=csv`, 'reporte_ventas_csv');
  pedir('/reportes/cuentas-pendientes?size=20', 'cuentas_pendientes');
  pedir(`/dashboard?desde=${haceDias(89)}&hasta=${haceDias(0)}`, 'dashboard');
  sleep(1);
}

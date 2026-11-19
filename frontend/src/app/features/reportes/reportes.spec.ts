import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, RouterOutlet } from '@angular/router';

import { authInterceptor } from '../../core/auth/auth.interceptor';
import { UsuarioSesion } from '../../core/auth/auth.models';
import { Permiso } from '../../core/auth/permisos';
import { iniciarSesionDePrueba } from '../../core/auth/sesion-de-prueba';
import { CREAR_GRAFICA } from '../../shared/ui/chart/chart';
import { paginar, periodoInicial } from './base-reporte';
import { ESTADO_POR_NIVEL } from './reporte-inventario';
import { ReporteInventario, ReporteServicios, ReporteVentas } from './reportes-api.service';
import { REPORTES_ROUTES } from './reportes.routes';

const API = '/api/v1/reportes';

const SERVICIOS: ReporteServicios = {
  ordenes: 2,
  servicios: 3,
  ingresosManoObra: 120000,
  ingresosRepuestos: 80000,
  horasPromedioEnTaller: 26.5,
  porServicio: [{ nombre: 'Cambio de aceite', cantidad: 2, ingresos: 80000 }],
  detalle: [
    {
      ordenId: 7,
      numero: 'OT-000007',
      fechaFinalizacion: '2026-11-16T15:00:00Z',
      placa: 'ABC12D',
      cliente: 'Carlos Pérez',
      mecanicos: 'Mario Mecánico',
      servicios: 2,
      manoObra: 80000,
      repuestos: 50000,
      total: 154700,
      horasEnTaller: 30,
    },
  ],
};

const INVENTARIO: ReporteInventario = {
  productos: 2,
  unidades: 12,
  valorInventario: 300000,
  conStockBajo: 1,
  agotados: 0,
  detalle: [
    {
      id: 1,
      codigo: 'FIL-001',
      nombre: 'Filtro de aceite',
      categoria: 'Filtros',
      unidad: 'UND',
      stockActual: 2,
      disponible: 2,
      minimo: 5,
      costoPromedio: 15000,
      valor: 30000,
      nivel: 'BAJO',
    },
    {
      id: 2,
      codigo: 'LLA-001',
      nombre: 'Llanta trasera',
      categoria: 'Llantas',
      unidad: 'UND',
      stockActual: 10,
      disponible: 10,
      minimo: 2,
      costoPromedio: 27000,
      valor: 270000,
      nivel: 'NORMAL',
    },
  ],
  movimientos: [{ tipo: 'SALIDA_VENTA', cantidad: 4, unidades: 6, valor: 90000 }],
};

const VENTAS: ReporteVentas = {
  ventas: 1,
  subtotal: 100000,
  descuento: 0,
  impuesto: 19000,
  total: 119000,
  costo: 60000,
  utilidadBruta: 40000,
  margenPorcentaje: 40,
  porDia: [{ clave: '2026-11-16', valor: 119000 }],
  porMetodo: [{ clave: 'EFECTIVO', valor: 119000 }],
  detalle: [
    {
      ventaId: 3,
      numero: 'V-000003',
      fecha: '2026-11-16T15:00:00Z',
      vendedor: 'Vera Vendedora',
      metodo: 'EFECTIVO',
      total: 119000,
      costo: 60000,
      utilidad: 40000,
    },
  ],
};

@Component({ imports: [RouterOutlet], template: '<router-outlet />' })
class Anfitrion {}

async function montar(url: string, sesion: Partial<UsuarioSesion> = {}) {
  window.matchMedia = vi
    .fn()
    .mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'reportes', children: REPORTES_ROUTES },
        { path: 'acceso-denegado', children: [] },
      ]),
      provideHttpClient(withInterceptors([authInterceptor])),
      provideHttpClientTesting(),
      { provide: CREAR_GRAFICA, useValue: () => ({ destroy: () => undefined }) },
    ],
  });
  iniciarSesionDePrueba(sesion);
  const fixture = TestBed.createComponent(Anfitrion);
  const router = TestBed.inject(Router);
  await router.navigateByUrl(url);
  fixture.detectChanges();
  const http = TestBed.inject(HttpTestingController);
  // Opciones de los filtros: no interesan aquí
  for (const r of http.match((r) => !r.url.startsWith(API))) r.flush([]);
  return { fixture, router, http, el: fixture.nativeElement as HTMLElement };
}

async function responder(m: Awaited<ReturnType<typeof montar>>, ruta: string, datos: object) {
  const req = m.http.expectOne((r) => r.url === `${API}/${ruta}`);
  req.flush(datos);
  m.fixture.detectChanges();
  await m.fixture.whenStable();
  m.fixture.detectChanges();
  return req;
}

function permisos(...area: Permiso[]): Partial<UsuarioSesion> {
  return { rol: 'VENDEDOR', permisos: ['DASHBOARD_VER', 'REPORTES_VER', ...area] };
}

// CP-133
describe('Reportes', () => {
  it('solo muestra las pestañas del área del usuario y abre la primera', async () => {
    const m = await montar('/reportes', permisos('PRESUPUESTOS_GESTIONAR', 'PAGOS_REGISTRAR'));

    expect(m.router.url).toBe('/reportes/servicios');
    const pestanas = Array.from(m.el.querySelectorAll('[role="tab"]')).map((t) =>
      t.textContent?.trim(),
    );
    expect(pestanas).toEqual(['Servicios', 'Cuentas pendientes']);
    expect(m.el.querySelector('[aria-selected="true"]')?.textContent).toContain('Servicios');
    m.http.match(() => true);
  });

  it('sin permiso de costos no se entra al reporte de inventario', async () => {
    const m = await montar('/reportes/inventario', permisos('PRESUPUESTOS_GESTIONAR'));

    expect(m.router.url).toBe('/acceso-denegado');
    m.http.verify();
  });

  it('almacén abre directamente el reporte de inventario', async () => {
    const m = await montar('/reportes', {
      rol: 'ALMACEN',
      permisos: ['REPORTES_VER', 'PRODUCTOS_GESTIONAR'],
    });

    expect(m.router.url).toBe('/reportes/inventario');
    m.http.match(() => true);
  });

  it('servicios: pide los últimos 30 días, muestra KPIs y detalle, y filtra por mecánico', async () => {
    const m = await montar('/reportes/servicios');
    const req = await responder(m, 'servicios', SERVICIOS);

    const periodo = periodoInicial();
    expect(req.request.params.get('desde')).toBe(periodo.desde);
    expect(req.request.params.get('hasta')).toBe(periodo.hasta);
    expect(req.request.params.has('mecanicoId')).toBe(false);
    const kpis = Array.from(m.el.querySelectorAll('hk-stat-card')).map((k) =>
      k.textContent?.replace(/\s+/g, ' '),
    );
    expect(kpis[0]).toContain('Servicios realizados: 3');
    expect(kpis[1]).toContain('$ 120.000');
    expect(kpis[3]).toContain('26,5 h');
    expect(m.el.textContent).toContain('OT-000007');
  });

  it('exportar descarga el CSV con los mismos filtros', async () => {
    const m = await montar('/reportes/ventas');
    await responder(m, 'ventas', VENTAS);
    URL.createObjectURL = vi.fn().mockReturnValue('blob:csv');
    URL.revokeObjectURL = vi.fn();
    const clic = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    Array.from(m.el.querySelectorAll<HTMLButtonElement>('button'))
      .find((b) => b.textContent?.includes('Exportar CSV'))!
      .click();
    const req = m.http.expectOne((r) => r.url === `${API}/ventas`);
    expect(req.request.params.get('formato')).toBe('csv');
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['﻿venta;fecha']));

    expect(clic).toHaveBeenCalled();
    expect((clic.mock.contexts[0] as HTMLAnchorElement).download).toBe(
      `reporte-ventas-${periodoInicial().desde}-a-${periodoInicial().hasta}.csv`,
    );
    clic.mockRestore();
  });

  it('ventas: muestra utilidad y margen; sin gestionar usuarios no hay filtro de vendedor', async () => {
    const m = await montar('/reportes/ventas', permisos('VENTAS_ANULAR'));
    await responder(m, 'ventas', VENTAS);

    expect(m.el.textContent).toContain('Utilidad bruta');
    expect(m.el.textContent?.replace(/\s+/g, ' ')).toContain('40 %');
    expect(m.el.textContent).not.toContain('Todos los vendedores');
    expect(m.el.textContent).toContain('V-000003');
  });

  it('inventario: el filtro de nivel es local y la tabla usa el badge de stock', async () => {
    const m = await montar('/reportes/inventario');
    await responder(m, 'inventario', INVENTARIO);
    expect(m.el.textContent).toContain('Llanta trasera');

    const select = Array.from(m.el.querySelectorAll('select')).find((s) =>
      s.textContent?.includes('Todos los niveles'),
    )!;
    select.value = 'BAJO';
    select.dispatchEvent(new Event('change'));
    m.fixture.detectChanges();

    expect(m.el.textContent).toContain('Filtro de aceite');
    expect(m.el.textContent).not.toContain('Llanta trasera');
    m.http.expectNone((r) => r.url === `${API}/inventario`);
    expect(ESTADO_POR_NIVEL.NORMAL).toBe('OK');
  });

  it('si el reporte falla muestra el error con reintento', async () => {
    const m = await montar('/reportes/servicios');
    m.http
      .expectOne((r) => r.url === `${API}/servicios`)
      .flush({ code: 'PARAMETRO_INVALIDO' }, { status: 400, statusText: 'Bad Request' });
    m.fixture.detectChanges();
    await m.fixture.whenStable();

    expect(m.el.textContent).toContain('No se pudo generar el reporte');
  });
});

describe('paginar', () => {
  it('pagina en el cliente y vuelve a la primera página cuando cambian las filas', () => {
    const filas = signal(Array.from({ length: 45 }, (_, i) => i));
    const p = TestBed.runInInjectionContext(() => paginar(filas, 20));

    expect(p.total()).toBe(45);
    p.ir(2);
    expect(p.visibles()).toEqual([40, 41, 42, 43, 44]);
    filas.set([1, 2, 3]);
    expect(p.pagina()).toBe(0);
    expect(p.visibles()).toEqual([1, 2, 3]);
  });
});

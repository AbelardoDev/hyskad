import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { authInterceptor } from '../../core/auth/auth.interceptor';
import { iniciarSesionDePrueba } from '../../core/auth/sesion-de-prueba';
import { UsuarioSesion } from '../../core/auth/auth.models';
import { CREAR_GRAFICA } from '../../shared/ui/chart/chart';
import { Dashboard } from './dashboard-api.service';
import { desdeParaPeriodo } from '../../core/utils/formato';
import { DashboardPage } from './dashboard-page';

const API = '/api/v1/dashboard';

function panel(cambios: Partial<Dashboard> = {}): Dashboard {
  return {
    vista: 'GENERAL',
    desde: '2026-10-19',
    hasta: '2026-11-17',
    kpis: {
      ventasHoyCantidad: 3,
      ventasHoyTotal: 450000,
      ingresosOrdenesHoy: 119000,
      ordenesActivas: 5,
      pendientesAprobacion: 2,
      porCobrar: 238000,
      productosStockBajo: 1,
      finalizadasMes: null,
    },
    ingresosDiarios: [
      { dia: '2026-11-16', ventas: 100000, ordenes: 0 },
      { dia: '2026-11-17', ventas: 450000, ordenes: 119000 },
    ],
    ordenesPorEstado: { RECIBIDA: 2, EN_REPARACION: 3 },
    topServicios: [{ nombre: 'Cambio de aceite', cantidad: 4, ingresos: 160000 }],
    topRepuestos: [],
    ultimasOrdenes: [
      {
        id: 7,
        numero: 'OT-000007',
        estado: 'EN_REPARACION',
        placa: 'ABC12D',
        moto: 'Yamaha FZ 150',
        cliente: 'Carlos Pérez',
        actualizada: '2026-11-17T14:00:00Z',
      },
    ],
    stockCritico: [
      {
        id: 3,
        codigo: 'FIL-001',
        nombre: 'Filtro de aceite',
        unidad: 'UND',
        disponible: 0,
        minimo: 5,
      },
    ],
    ...cambios,
  };
}

function montar(sesion: Partial<UsuarioSesion> = {}) {
  window.matchMedia = vi
    .fn()
    .mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  const graficas: string[] = [];
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideHttpClient(withInterceptors([authInterceptor])),
      provideHttpClientTesting(),
      {
        provide: CREAR_GRAFICA,
        useValue: (_: HTMLCanvasElement, config: { type: string }) => {
          graficas.push(config.type);
          return { destroy: () => undefined };
        },
      },
    ],
  });
  iniciarSesionDePrueba(sesion);
  const fixture = TestBed.createComponent(DashboardPage);
  fixture.detectChanges();
  const http = TestBed.inject(HttpTestingController);
  return { fixture, http, graficas, el: fixture.nativeElement as HTMLElement };
}

async function responder(m: ReturnType<typeof montar>, datos: Dashboard) {
  m.http.expectOne((r) => r.url === API).flush(datos);
  m.fixture.detectChanges();
  await m.fixture.whenStable();
}

describe('DashboardPage', () => {
  it('muestra el saludo, skeletons mientras carga y luego KPIs, gráficas y listas', async () => {
    const m = montar();
    expect(m.el.querySelector('h1')?.textContent).toContain('Hola, Ana');
    expect(m.el.querySelector('[aria-busy="true"] hk-skeleton')).not.toBeNull();

    await responder(m, panel());

    const titulos = Array.from(m.el.querySelectorAll('hk-stat-card')).map((c) => c.textContent);
    // Los bloques en null (finalizadas del mes) no aparecen
    expect(titulos).toHaveLength(6);
    expect(titulos[0]).toContain('Ventas de hoy');
    expect(titulos[0]?.replace(/\s/g, ' ')).toContain('$ 450.000');
    expect(titulos[0]).toContain('Cantidad: 3');
    expect(m.graficas).toEqual(expect.arrayContaining(['line', 'doughnut', 'bar']));
    expect(m.el.textContent).toContain('OT-000007');
    expect(m.el.textContent).toContain('Filtro de aceite');
  });

  it('el selector de periodo pide el rango con hoy incluido', async () => {
    const m = montar();
    const primera = m.http.expectOne((r) => r.url === API);
    expect(primera.request.params.get('hasta')).toBeTruthy();
    primera.flush(panel());
    m.fixture.detectChanges();
    await m.fixture.whenStable();

    const siete = Array.from(
      m.el.querySelectorAll<HTMLButtonElement>('[role="group"] button'),
    ).find((b) => b.textContent?.includes('7'))!;
    siete.click();
    m.fixture.detectChanges();

    const req = m.http.expectOne((r) => r.url === API);
    const hasta = req.request.params.get('hasta')!;
    expect(req.request.params.get('desde')).toBe(desdeParaPeriodo(hasta, 7));
    expect(siete.getAttribute('aria-pressed')).toBe('true');
  });

  it('el mecánico ve sus órdenes por estado y el acceso a "Mis órdenes", sin selector de periodo', async () => {
    const m = montar({ rol: 'MECANICO', permisos: ['DASHBOARD_VER', 'ORDENES_VER_ASIGNADAS'] });
    await responder(
      m,
      panel({
        vista: 'MECANICO',
        kpis: {
          ventasHoyCantidad: null,
          ventasHoyTotal: null,
          ingresosOrdenesHoy: null,
          ordenesActivas: 2,
          pendientesAprobacion: null,
          porCobrar: null,
          productosStockBajo: null,
          finalizadasMes: 4,
        },
        ingresosDiarios: [],
        topServicios: [],
        stockCritico: [],
      }),
    );

    expect(m.el.querySelectorAll('hk-stat-card')).toHaveLength(2);
    expect(m.el.querySelector('[role="group"]')).toBeNull();
    expect(m.graficas).toEqual(['doughnut']);
    expect(m.el.querySelector('a[href="/ordenes/mias"]')?.textContent).toContain(
      'Ir a mis órdenes',
    );
  });

  it('si falla muestra el error con reintento', async () => {
    const m = montar();
    m.http
      .expectOne((r) => r.url === API)
      .flush({ code: 'ERROR_INTERNO' }, { status: 500, statusText: 'Error' });
    m.fixture.detectChanges();
    await m.fixture.whenStable();

    expect(m.el.textContent).toContain('No pudimos cargar el panel');
    m.el.querySelector<HTMLButtonElement>('hk-empty-state button')!.click();
    m.fixture.detectChanges();
    m.http.expectOne((r) => r.url === API);
  });

  it('desdeParaPeriodo cuenta hoy dentro del periodo y cruza meses', () => {
    expect(desdeParaPeriodo('2026-11-17', 7)).toBe('2026-11-11');
    expect(desdeParaPeriodo('2026-03-01', 1)).toBe('2026-03-01');
    expect(desdeParaPeriodo('2026-03-01', 2)).toBe('2026-02-28');
  });
});

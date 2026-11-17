import { DialogRef } from '@angular/cdk/dialog';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { authInterceptor } from '../auth/auth.interceptor';
import { UsuarioSesion } from '../auth/auth.models';
import { iniciarSesionDePrueba } from '../auth/sesion-de-prueba';
import { ThemeService } from '../theme/theme.service';
import { ResultadoBusqueda } from './busqueda-api.service';
import { DEBOUNCE_BUSQUEDA_MS, HkCommandPalette, normalizar } from './command-palette';

const API = '/api/v1/busqueda';

const RESULTADO: ResultadoBusqueda = {
  clientes: [{ id: 2, titulo: 'Carlos Pérez', detalle: 'CC 1067845123 · 3004567812' }],
  motocicletas: [{ id: 9, titulo: 'ABC12D', detalle: 'Yamaha FZ 150 · Carlos Pérez' }],
  ordenes: [{ id: 7, titulo: 'OT-000007', detalle: 'ABC12D · Carlos Pérez · EN_REPARACION' }],
  productos: [],
  ventas: [],
};

function montar(sesion: Partial<UsuarioSesion> = {}) {
  window.matchMedia = vi
    .fn()
    .mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  const cerrar = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: '**', children: [] }]),
      provideHttpClient(withInterceptors([authInterceptor])),
      provideHttpClientTesting(),
      { provide: DialogRef, useValue: { close: cerrar } },
    ],
  });
  iniciarSesionDePrueba(sesion);
  const fixture = TestBed.createComponent(HkCommandPalette);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const input = el.querySelector<HTMLInputElement>('[role="combobox"]')!;
  const http = TestBed.inject(HttpTestingController);

  const escribir = (texto: string) => {
    input.value = texto;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };
  const tecla = (key: string) => {
    input.dispatchEvent(new KeyboardEvent('keydown', { key, cancelable: true }));
    fixture.detectChanges();
  };
  const opciones = () =>
    Array.from(el.querySelectorAll('[role="option"]')).map((o) => o.textContent?.trim() ?? '');
  const activa = () =>
    el.querySelector(`#${input.getAttribute('aria-activedescendant')}`)?.textContent?.trim();
  return { fixture, el, input, http, cerrar, escribir, tecla, opciones, activa };
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function esperarBusqueda(m: ReturnType<typeof montar>) {
  await esperar(DEBOUNCE_BUSQUEDA_MS + 30);
  m.fixture.detectChanges();
}

describe('HkCommandPalette', () => {
  it('sin escribir ofrece las acciones rápidas que permite el rol', () => {
    const admin = montar();
    expect(admin.opciones()).toEqual([
      'Nueva venta',
      'Recibir moto',
      'Nuevo cliente',
      'Cambiar a tema oscuro',
    ]);
    expect(admin.activa()).toBe('Nueva venta');
    expect(admin.input.getAttribute('aria-expanded')).toBe('true');
    TestBed.resetTestingModule();

    const almacen = montar({ rol: 'ALMACEN', permisos: ['DASHBOARD_VER', 'PRODUCTOS_VER'] });
    expect(almacen.opciones()).toEqual(['Cambiar a tema oscuro']);
  });

  it('busca 250 ms después de la última tecla y solo desde 2 caracteres', async () => {
    const m = montar();
    m.escribir('a');
    await esperarBusqueda(m);
    m.http.expectNone(() => true);
    expect(m.el.textContent).toContain('Escribe al menos 2 caracteres');

    m.escribir('ab');
    await esperar(100);
    m.escribir('abc');
    m.http.expectNone(() => true);
    await esperarBusqueda(m);

    const req = m.http.expectOne((r) => r.url === API);
    expect(req.request.params.get('q')).toBe('abc');
  });

  it('agrupa los resultados por tipo y traduce el estado de la orden', async () => {
    const m = montar();
    m.escribir('abc12');
    await esperarBusqueda(m);
    m.http.expectOne((r) => r.url === API).flush(RESULTADO);
    await m.fixture.whenStable();
    m.fixture.detectChanges();

    const grupos = Array.from(m.el.querySelectorAll('[role="group"]')).map((g) =>
      g.querySelector('p')?.textContent?.trim(),
    );
    expect(grupos).toEqual(['Motocicletas', 'Órdenes', 'Clientes']);
    expect(m.el.querySelector('[role="option"] hk-placa')?.textContent).toContain('ABC 12D');
    expect(m.el.textContent).toContain('ABC12D · Carlos Pérez · En reparación');
  });

  it('las flechas recorren las opciones en círculo y Enter abre la elegida', async () => {
    const m = montar();
    m.escribir('abc12');
    await esperarBusqueda(m);
    m.http.expectOne((r) => r.url === API).flush(RESULTADO);
    await m.fixture.whenStable();
    m.fixture.detectChanges();
    const router = TestBed.inject(Router);

    expect(m.activa()).toContain('ABC 12D');
    m.tecla('ArrowDown');
    expect(m.activa()).toContain('OT-000007');
    m.tecla('ArrowUp');
    m.tecla('ArrowUp');
    expect(m.activa()).toContain('Carlos Pérez');
    m.tecla('ArrowDown');
    m.tecla('Enter');
    await m.fixture.whenStable();

    expect(m.cerrar).toHaveBeenCalled();
    expect(router.url).toBe('/motocicletas/9');
  });

  it('avisa cuando no hay resultados y filtra acciones y páginas por lo escrito', async () => {
    const m = montar();
    m.escribir('clien');
    await esperarBusqueda(m);
    m.http
      .expectOne((r) => r.url === API)
      .flush({
        clientes: [],
        motocicletas: [],
        ordenes: [],
        productos: [],
        ventas: [],
      });
    await m.fixture.whenStable();
    m.fixture.detectChanges();

    expect(m.el.textContent).toContain('Sin resultados para «clien»');
    expect(m.opciones()).toEqual(['Nuevo cliente', 'Clientes']);
  });

  it('la acción de tema cambia entre claro y oscuro', () => {
    const m = montar();
    m.escribir('tema');
    m.tecla('Enter');

    expect(TestBed.inject(ThemeService).preferencia()).toBe('dark');
    expect(m.cerrar).toHaveBeenCalled();
  });

  it('normalizar ignora mayúsculas y tildes', () => {
    expect(normalizar('  Órdenes ')).toBe('ordenes');
  });
});

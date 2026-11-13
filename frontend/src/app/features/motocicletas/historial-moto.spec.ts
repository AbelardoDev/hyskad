import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { authInterceptor } from '../../core/auth/auth.interceptor';
import { iniciarSesionDePrueba } from '../../core/auth/sesion-de-prueba';
import { errorInterceptor } from '../../core/http/error.interceptor';
import { HkHistorialMoto, progresionKilometraje } from './historial-moto';
import { HistorialServicio } from './motocicletas-api.service';

const entrada = (
  ordenId: number,
  kilometrajeIngreso: number,
  kilometrajeInspeccion: number | null = null,
): HistorialServicio => ({
  ordenId,
  numero: `OT-00000${ordenId}`,
  estado: 'ENTREGADA',
  fechaIngreso: '2026-11-10T14:00:00Z',
  fechaFinalizacion: '2026-11-11T14:00:00Z',
  fechaEntrega: '2026-11-11T18:00:00Z',
  kilometrajeIngreso,
  kilometrajeInspeccion,
  motivoIngreso: 'Mantenimiento',
  diagnostico: 'Cadena destensionada',
  servicios: [{ descripcion: 'Ajuste de cadena', precio: 30000 }],
  repuestos: [],
  total: 35700,
  mecanicos: ['Mario Mecánico'],
});

const texto = (el: Element) => el.textContent?.replace(/\s+/g, ' ').trim() ?? '';

describe('progresionKilometraje', () => {
  it('usa la lectura de inspección si la hay y calcula lo recorrido desde la orden anterior', () => {
    const entradas = progresionKilometraje([
      entrada(3, 3000, 3100),
      entrada(2, 2000),
      entrada(1, 1000),
    ]);
    expect(entradas.map((e) => e.kilometraje)).toEqual([3100, 2000, 1000]);
    expect(entradas.map((e) => e.recorrido)).toEqual([1100, 1000, null]);
  });
});

describe('HkHistorialMoto', () => {
  it('pide el historial sin canceladas, lo muestra expandible y al pedirlas recarga', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([errorInterceptor, authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    iniciarSesionDePrueba();
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(HkHistorialMoto);
    fixture.componentRef.setInput('motocicletaId', 9);
    fixture.detectChanges();

    const req = http.expectOne((r) => r.url === '/api/v1/motocicletas/9/historial');
    expect(req.request.params.get('incluirCanceladas')).toBe('false');
    req.flush({
      content: [entrada(2, 2000), entrada(1, 1000)],
      page: 0,
      size: 10,
      totalElements: 2,
      totalPages: 1,
    });
    fixture.detectChanges();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    expect(texto(el)).toContain('OT-000002');
    expect(texto(el)).toContain('+1.000 km desde la anterior');
    const boton = el.querySelector<HTMLButtonElement>('button[aria-expanded]')!;
    expect(boton.getAttribute('aria-expanded')).toBe('false');
    expect(texto(el)).not.toContain('Ajuste de cadena');
    boton.click();
    fixture.detectChanges();
    expect(boton.getAttribute('aria-expanded')).toBe('true');
    expect(texto(el)).toContain('Ajuste de cadena');
    expect(texto(el)).toContain('Mario Mecánico');

    el.querySelector<HTMLButtonElement>('button[role="switch"]')!.click();
    fixture.detectChanges();
    const conCanceladas = http.expectOne((r) => r.url === '/api/v1/motocicletas/9/historial');
    expect(conCanceladas.request.params.get('incluirCanceladas')).toBe('true');
    expect(conCanceladas.request.params.get('page')).toBe('0');
  });
});

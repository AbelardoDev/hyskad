import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { authInterceptor } from '../../core/auth/auth.interceptor';
import { iniciarSesionDePrueba } from '../../core/auth/sesion-de-prueba';
import { CREAR_EVENT_SOURCE } from '../../core/realtime/notificaciones-stream.service';
import { NotificacionesPage } from '../notificaciones/notificaciones-page';
import { AuditoriaPage } from './auditoria-page';
import { RegistroAuditoria } from './auditoria-api.service';

@Component({ template: '' })
class Vacia {}

const vacia = { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 };
const texto = (el: Element) => el.textContent?.replace(/\s+/g, ' ').trim() ?? '';

const registro: RegistroAuditoria = {
  id: 1,
  fecha: '2026-11-12T15:00:00Z',
  usuario: { id: 1, nombre: 'Ana Admin' },
  accion: 'VENTA_ANULADA',
  entidad: 'venta',
  entidadId: 5,
  detalle: { numero: 'V-000005', motivo: 'Error de digitación' },
  ip: '10.0.0.1',
};

function configurar() {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: '**', component: Vacia }]),
      provideHttpClient(withInterceptors([authInterceptor])),
      provideHttpClientTesting(),
      {
        provide: CREAR_EVENT_SOURCE,
        useValue: () => ({ close: () => undefined, addEventListener: () => undefined }),
      },
    ],
  });
  iniciarSesionDePrueba();
  return TestBed.inject(HttpTestingController);
}

describe('AuditoriaPage', () => {
  it('lista con filtros y abre el detalle como clave → valor', async () => {
    const http = configurar();
    const fixture = TestBed.createComponent(AuditoriaPage);
    fixture.detectChanges();
    http.expectOne((r) => r.url === '/api/v1/usuarios').flush(vacia);
    const req = http.expectOne((r) => r.url === '/api/v1/auditoria');
    expect(req.request.params.get('page')).toBe('0');
    req.flush({ ...vacia, content: [registro], totalElements: 1, totalPages: 1 });
    fixture.detectChanges();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(texto(el)).toContain('VENTA_ANULADA');
    expect(texto(el)).toContain('Venta #5');

    el.querySelector<HTMLElement>('tbody tr')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    const panel = document.querySelector('hk-detalle-auditoria-drawer')!;
    expect(texto(panel)).toContain('motivo');
    expect(texto(panel)).toContain('Error de digitación');
    expect(texto(panel)).toContain('10.0.0.1');
  });

  it('con ?entidad e ?entidadId muestra la historia del registro', async () => {
    const http = configurar();
    const fixture = TestBed.createComponent(AuditoriaPage);
    fixture.componentRef.setInput('entidad', 'orden_trabajo');
    fixture.componentRef.setInput('entidadId', '7');
    fixture.detectChanges();
    http.expectOne((r) => r.url === '/api/v1/usuarios').flush(vacia);
    http.expectOne((r) => r.url === '/api/v1/auditoria/entidad/orden_trabajo/7').flush(vacia);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(texto(fixture.nativeElement as HTMLElement)).toContain(
      'Historia de Orden de trabajo #7',
    );
  });
});

describe('NotificacionesPage', () => {
  it('filtra por no leídas', async () => {
    const http = configurar();
    const fixture = TestBed.createComponent(NotificacionesPage);
    fixture.detectChanges();
    // La campana (servicio global) también carga sus datos
    http
      .match((r) => r.url === '/api/v1/notificaciones/conteo-no-leidas')
      .forEach((r) => r.flush({ noLeidas: 0 }));
    http.match('/api/v1/notificaciones/stream-ticket').forEach((r) => r.flush({ ticket: 't' }));
    http.match((r) => r.url === '/api/v1/notificaciones').forEach((r) => r.flush(vacia));
    fixture.detectChanges();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(texto(el)).toContain('No tienes notificaciones');

    Array.from(el.querySelectorAll<HTMLButtonElement>('[role="group"] button'))
      .find((b) => texto(b) === 'No leídas')!
      .click();
    fixture.detectChanges();
    const req = http.expectOne(
      (r) => r.url === '/api/v1/notificaciones' && r.params.get('soloNoLeidas') === 'true',
    );
    req.flush(vacia);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(texto(el)).toContain('No tienes notificaciones sin leer');
  });
});

import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';

import { paresDetalle } from '../../features/auditoria/detalle-auditoria-drawer';
import { ToastService } from '../../shared/ui/toast/toast';
import { authInterceptor } from '../auth/auth.interceptor';
import { AuthService } from '../auth/auth.service';
import { iniciarSesionDePrueba } from '../auth/sesion-de-prueba';
import { HkCampanaNotificaciones } from './campana';
import { textoNotificacion } from './notificacion-ui';
import { Notificacion } from './notificaciones-api.service';
import {
  CREAR_EVENT_SOURCE,
  esperaReconexion,
  NotificacionesStreamService,
} from './notificaciones-stream.service';

const API = '/api/v1/notificaciones';

@Component({ template: '' })
class Vacia {}

/** `EventSource` falso: jsdom no lo implementa. */
class FuenteFalsa {
  static creadas: FuenteFalsa[] = [];
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  cerrada = false;
  private readonly oyentes = new Map<string, (e: MessageEvent<string>) => void>();

  constructor(readonly url: string) {
    FuenteFalsa.creadas.push(this);
  }

  addEventListener(tipo: string, oyente: (e: MessageEvent<string>) => void): void {
    this.oyentes.set(tipo, oyente);
  }

  close(): void {
    this.cerrada = true;
  }

  emitir(n: Notificacion): void {
    this.oyentes.get('notificacion')?.(
      new MessageEvent('notificacion', { data: JSON.stringify(n) }),
    );
  }
}

const notificacion = (id: number, cambios: Partial<Notificacion> = {}): Notificacion => ({
  id,
  tipo: 'ESTADO_ORDEN_CAMBIADO',
  tituloClave: 'notificaciones.tipos.ESTADO_ORDEN_CAMBIADO.titulo',
  mensajeClave: 'notificaciones.tipos.ESTADO_ORDEN_CAMBIADO.mensaje',
  parametros: { numero: 'OT-000007', placa: 'ABC12D', estado: 'EN_DIAGNOSTICO' },
  enlace: '/ordenes/7',
  leida: false,
  fecha: '2026-11-12T15:00:00Z',
  ...cambios,
});

const vacia = { content: [], page: 0, size: 10, totalElements: 0, totalPages: 0 };

function configurar() {
  FuenteFalsa.creadas = [];
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: '**', component: Vacia }]),
      provideHttpClient(withInterceptors([authInterceptor])),
      provideHttpClientTesting(),
      {
        provide: CREAR_EVENT_SOURCE,
        useValue: (url: string) => new FuenteFalsa(url) as unknown as EventSource,
      },
    ],
  });
  const http = TestBed.inject(HttpTestingController);
  const stream = TestBed.inject(NotificacionesStreamService);
  iniciarSesionDePrueba();
  TestBed.tick();
  return { http, stream };
}

/** Responde la carga inicial: conteo, recientes y ticket. */
function responderConexion(
  http: HttpTestingController,
  noLeidas = 0,
  recientes: Notificacion[] = [],
) {
  http.expectOne(`${API}/conteo-no-leidas`).flush({ noLeidas });
  http
    .expectOne((r) => r.url === API)
    .flush({ ...vacia, content: recientes, totalElements: recientes.length });
  http.expectOne(`${API}/stream-ticket`).flush({ ticket: 'tkt-1' });
}

describe('reglas del tiempo real', () => {
  it('la espera de reconexión crece exponencialmente hasta 30 s', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map(esperaReconexion)).toEqual([
      1000, 2000, 4000, 8000, 16000, 30000, 30000,
    ]);
  });

  it('el texto traduce los parámetros y el estado de la orden', () => {
    TestBed.configureTestingModule({});
    const { titulo, mensaje } = textoNotificacion(
      notificacion(1),
      TestBed.inject(TranslocoService),
    );
    expect(titulo).toBe('Orden OT-000007: En diagnóstico');
    expect(mensaje).toBe('La moto ABC12D pasó a En diagnóstico.');
  });

  it('el detalle de auditoría se aplana a pares clave → valor', () => {
    expect(
      paresDetalle({ numero: 'V-000001', campos: ['nombre', 'email'], cambio: { de: 1, a: null } }),
    ).toEqual([
      { clave: 'numero', valor: 'V-000001' },
      { clave: 'campos', valor: 'nombre, email' },
      { clave: 'cambio.de', valor: '1' },
      { clave: 'cambio.a', valor: '—' },
    ]);
    expect(paresDetalle(null)).toEqual([]);
  });
});

describe('NotificacionesStreamService', () => {
  it('con sesión carga el conteo y abre el stream con el ticket', () => {
    const { http, stream } = configurar();
    responderConexion(http, 3, [notificacion(9, { leida: true })]);

    expect(stream.noLeidas()).toBe(3);
    expect(stream.recientes().map((n) => n.id)).toEqual([9]);
    expect(FuenteFalsa.creadas).toHaveLength(1);
    expect(FuenteFalsa.creadas[0].url).toBe(`${API}/stream?ticket=tkt-1`);
    FuenteFalsa.creadas[0].onopen?.();
    expect(stream.conectado()).toBe(true);
  });

  it('una notificación nueva suma al conteo, entra primera y avisa con un toast', () => {
    const { http, stream } = configurar();
    responderConexion(http, 1, [notificacion(1)]);
    const info = vi.spyOn(TestBed.inject(ToastService), 'info');

    FuenteFalsa.creadas[0].emitir(notificacion(2));

    expect(stream.noLeidas()).toBe(2);
    expect(stream.recientes().map((n) => n.id)).toEqual([2, 1]);
    expect(info).toHaveBeenCalledWith(
      'Orden OT-000007: En diagnóstico',
      'La moto ABC12D pasó a En diagnóstico.',
    );
  });

  it('si se corta pide otro ticket y reconecta con espera', () => {
    vi.useFakeTimers();
    try {
      const { http } = configurar();
      responderConexion(http);
      FuenteFalsa.creadas[0].onerror?.();
      expect(FuenteFalsa.creadas[0].cerrada).toBe(true);

      vi.advanceTimersByTime(999);
      http.expectNone(`${API}/stream-ticket`);
      vi.advanceTimersByTime(1);
      responderConexion(http);
      expect(FuenteFalsa.creadas).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('al cerrar sesión se desconecta y limpia', async () => {
    const { http, stream } = configurar();
    responderConexion(http, 2, [notificacion(1)]);

    const salir = TestBed.inject(AuthService).logout();
    http.expectOne('/api/v1/auth/logout').flush(null);
    await salir;
    TestBed.tick();

    expect(FuenteFalsa.creadas[0].cerrada).toBe(true);
    expect(stream.noLeidas()).toBe(0);
    expect(stream.recientes()).toEqual([]);
  });

  it('marcar una como leída baja el conteo; marcar todas lo deja en cero', () => {
    const { http, stream } = configurar();
    responderConexion(http, 2, [notificacion(1), notificacion(2)]);

    stream.marcarLeida(stream.recientes()[0]);
    http.expectOne(`${API}/1/leida`).flush({ ...notificacion(1), leida: true });
    expect(stream.noLeidas()).toBe(1);
    expect(stream.recientes()[0].leida).toBe(true);

    stream.marcarTodasLeidas();
    const req = http.expectOne(`${API}/leidas`);
    expect(req.request.method).toBe('PATCH');
    req.flush({ marcadas: 1 });
    expect(stream.noLeidas()).toBe(0);
  });
});

describe('HkCampanaNotificaciones', () => {
  it('muestra el contador y la lista traducida; abrir una la marca y navega', async () => {
    const { http } = configurar();
    const fixture = TestBed.createComponent(HkCampanaNotificaciones);
    fixture.detectChanges();
    responderConexion(http, 1, [notificacion(5)]);
    fixture.detectChanges();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    const campana = el.querySelector<HTMLButtonElement>('button')!;
    expect(campana.getAttribute('aria-label')).toBe('Notificaciones, 1 sin leer');
    expect(el.textContent).toContain('1');
    campana.click();
    fixture.detectChanges();
    await fixture.whenStable();

    const panel = document.querySelector('[role="dialog"]')!;
    expect(panel.textContent).toContain('Orden OT-000007: En diagnóstico');
    expect(panel.textContent).toContain('Marcar todas como leídas');
    Array.from(panel.querySelectorAll<HTMLButtonElement>('li button'))[0].click();
    http.expectOne(`${API}/5/leida`).flush({ ...notificacion(5), leida: true });
  });
});

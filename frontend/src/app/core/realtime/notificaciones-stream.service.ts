import { DOCUMENT } from '@angular/common';
import { DestroyRef, effect, inject, Injectable, InjectionToken, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';

import { ToastService } from '../../shared/ui/toast/toast';
import { AuthService } from '../auth/auth.service';
import { erroresManejados } from '../http/contexto-http';
import { textoNotificacion } from './notificacion-ui';
import { Notificacion, NotificacionesApiService } from './notificaciones-api.service';

/** Cuántas notificaciones guarda la campana. */
export const RECIENTES = 10;
/** Espera de reconexión: 1 s, 2 s, 4 s… hasta 30 s (IC5). */
export const ESPERA_MAXIMA_MS = 30_000;

/** Fábrica de `EventSource`: se reemplaza en las pruebas (jsdom no lo implementa). */
export const CREAR_EVENT_SOURCE = new InjectionToken<(url: string) => EventSource>(
  'CREAR_EVENT_SOURCE',
  {
    providedIn: 'root',
    factory: () => (url: string) => new EventSource(url),
  },
);

/** Espera antes del intento `n` (desde 0): exponencial con tope de 30 s. */
export function esperaReconexion(intento: number): number {
  return Math.min(1000 * 2 ** intento, ESPERA_MAXIMA_MS);
}

/**
 * Notificaciones en tiempo real (RF30, IC5). Con sesión, carga el conteo y las recientes, pide un
 * ticket y abre el `EventSource`; si se corta, reconecta con espera exponencial (máx. 30 s). Al
 * cerrar sesión se desconecta. Cada notificación nueva suma al conteo, entra a la lista de la
 * campana y muestra un toast discreto si la pestaña está visible.
 */
@Injectable({ providedIn: 'root' })
export class NotificacionesStreamService {
  private readonly api = inject(NotificacionesApiService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly transloco = inject(TranslocoService);
  private readonly documento = inject(DOCUMENT);
  private readonly crearEventSource = inject(CREAR_EVENT_SOURCE);

  readonly noLeidas = signal(0);
  readonly recientes = signal<readonly Notificacion[]>([]);
  readonly conectado = signal(false);

  private fuente: EventSource | null = null;
  private reintento: ReturnType<typeof setTimeout> | undefined;
  private intentos = 0;
  /** Cambia en cada conexión o cierre: descarta respuestas de una conexión anterior. */
  private generacion = 0;

  constructor() {
    effect(() => {
      if (this.auth.estaAutenticado()) this.conectar();
      else this.desconectar();
    });
    inject(DestroyRef).onDestroy(() => this.desconectar());
  }

  /** Recarga el conteo y las recientes (p. ej. tras marcarlas desde la página de notificaciones). */
  recargar(): void {
    this.api.conteoNoLeidas(erroresManejados()).subscribe({
      next: ({ noLeidas }) => this.noLeidas.set(noLeidas),
      error: () => undefined,
    });
    this.api
      .listar({ soloNoLeidas: false, page: 0, size: RECIENTES }, erroresManejados())
      .subscribe({
        next: (pagina) => this.recientes.set(pagina.content),
        error: () => undefined,
      });
  }

  marcarLeida(notificacion: Notificacion): void {
    if (notificacion.leida) return;
    this.api.marcarLeida(notificacion.id, erroresManejados()).subscribe({
      next: () => {
        this.recientes.update((lista) =>
          lista.map((n) => (n.id === notificacion.id ? { ...n, leida: true } : n)),
        );
        this.noLeidas.update((n) => Math.max(0, n - 1));
      },
      error: () => undefined,
    });
  }

  marcarTodasLeidas(): void {
    this.api.marcarTodasLeidas().subscribe(() => {
      this.recientes.update((lista) => lista.map((n) => ({ ...n, leida: true })));
      this.noLeidas.set(0);
    });
  }

  private conectar(): void {
    this.desconectar();
    const generacion = this.generacion;
    this.recargar();
    this.abrir(generacion);
  }

  private abrir(generacion: number): void {
    this.api.ticket(erroresManejados()).subscribe({
      next: ({ ticket }) => {
        if (generacion !== this.generacion) return;
        const fuente = this.crearEventSource(this.api.urlStream(ticket));
        this.fuente = fuente;
        fuente.onopen = () => {
          this.intentos = 0;
          this.conectado.set(true);
        };
        fuente.addEventListener('notificacion', (evento) =>
          this.recibir(JSON.parse((evento as MessageEvent<string>).data) as Notificacion),
        );
        fuente.onerror = () => {
          // El ticket ya se gastó: EventSource no puede reconectar solo, se pide uno nuevo
          fuente.close();
          this.conectado.set(false);
          this.programarReintento(generacion);
        };
      },
      error: () => this.programarReintento(generacion),
    });
  }

  private programarReintento(generacion: number): void {
    if (generacion !== this.generacion || !this.auth.estaAutenticado()) return;
    clearTimeout(this.reintento);
    this.reintento = setTimeout(() => {
      if (generacion !== this.generacion) return;
      this.recargar();
      this.abrir(generacion);
    }, esperaReconexion(this.intentos++));
  }

  private recibir(notificacion: Notificacion): void {
    this.recientes.update((lista) =>
      [notificacion, ...lista.filter((n) => n.id !== notificacion.id)].slice(0, RECIENTES),
    );
    this.noLeidas.update((n) => n + 1);
    if (this.documento.visibilityState === 'visible') {
      const { titulo, mensaje } = textoNotificacion(notificacion, this.transloco);
      this.toast.info(titulo, mensaje);
    }
  }

  private desconectar(): void {
    this.generacion++;
    clearTimeout(this.reintento);
    this.fuente?.close();
    this.fuente = null;
    this.intentos = 0;
    this.conectado.set(false);
    if (!this.auth.estaAutenticado()) {
      this.noLeidas.set(0);
      this.recientes.set([]);
    }
  }
}

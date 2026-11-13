import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { Pagina } from '../http/pagina';

const API = '/api/v1/notificaciones';

export type TipoNotificacion =
  | 'ORDEN_CREADA'
  | 'MECANICO_ASIGNADO'
  | 'ESTADO_ORDEN_CAMBIADO'
  | 'PRESUPUESTO_ENVIADO'
  | 'PRESUPUESTO_APROBADO'
  | 'PRESUPUESTO_RECHAZADO'
  | 'ORDEN_FINALIZADA'
  | 'ORDEN_ENTREGADA'
  | 'STOCK_BAJO'
  | 'VENTA_ANULADA';

/** Notificación interna (RF30): claves de i18n y parámetros; el texto se arma en el idioma del usuario. */
export interface Notificacion {
  id: number;
  tipo: TipoNotificacion;
  tituloClave: string;
  mensajeClave: string;
  parametros: Record<string, string | number>;
  enlace: string | null;
  leida: boolean;
  fecha: string;
}

/** Notificaciones del usuario actual y el ticket del stream SSE (IC5). */
@Injectable({ providedIn: 'root' })
export class NotificacionesApiService {
  private readonly http = inject(HttpClient);

  listar(
    consulta: { soloNoLeidas: boolean; page: number; size: number },
    context?: HttpContext,
  ): Observable<Pagina<Notificacion>> {
    const params = new HttpParams()
      .set('soloNoLeidas', consulta.soloNoLeidas)
      .set('page', consulta.page)
      .set('size', consulta.size);
    return this.http.get<Pagina<Notificacion>>(API, { params, context });
  }

  conteoNoLeidas(context?: HttpContext): Observable<{ noLeidas: number }> {
    return this.http.get<{ noLeidas: number }>(`${API}/conteo-no-leidas`, { context });
  }

  marcarLeida(id: number, context?: HttpContext): Observable<Notificacion> {
    return this.http.patch<Notificacion>(`${API}/${id}/leida`, {}, { context });
  }

  marcarTodasLeidas(context?: HttpContext): Observable<{ marcadas: number }> {
    return this.http.patch<{ marcadas: number }>(`${API}/leidas`, {}, { context });
  }

  /** Ticket de un solo uso (30 s) para abrir el stream: `EventSource` no envía el JWT. */
  ticket(context?: HttpContext): Observable<{ ticket: string }> {
    return this.http.post<{ ticket: string }>(`${API}/stream-ticket`, {}, { context });
  }

  urlStream(ticket: string): string {
    return `${API}/stream?ticket=${encodeURIComponent(ticket)}`;
  }
}

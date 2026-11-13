import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { Pagina } from '../../core/http/pagina';

const API = '/api/v1/auditoria';

/** Entidades que registran auditoría en el backend (valor de `entidad`). */
export const ENTIDADES_AUDITADAS = [
  'orden_trabajo',
  'presupuesto',
  'venta',
  'compra',
  'producto',
  'categoria',
  'cliente',
  'motocicleta',
  'proveedor',
  'servicio',
  'usuario',
] as const;

/** Registro de auditoría (RF31, RN-51). */
export interface RegistroAuditoria {
  id: number;
  fecha: string;
  usuario: { id: number; nombre: string } | null;
  accion: string;
  entidad: string;
  entidadId: number | null;
  detalle: Record<string, unknown> | null;
  ip: string | null;
}

export interface FiltrosAuditoria {
  usuarioId: number | null;
  entidad: string | null;
  /** Con `entidad`, la historia de un registro (`/auditoria/entidad/{entidad}/{id}`). */
  entidadId: number | null;
  accion: string;
  desde: string | null;
  hasta: string | null;
  page: number;
  size: number;
}

@Injectable({ providedIn: 'root' })
export class AuditoriaApiService {
  private readonly http = inject(HttpClient);

  buscar(filtros: FiltrosAuditoria, context?: HttpContext): Observable<Pagina<RegistroAuditoria>> {
    let params = new HttpParams().set('page', filtros.page).set('size', filtros.size);
    if (filtros.entidad && filtros.entidadId !== null) {
      return this.http.get<Pagina<RegistroAuditoria>>(
        `${API}/entidad/${filtros.entidad}/${filtros.entidadId}`,
        { params, context },
      );
    }
    if (filtros.usuarioId !== null) params = params.set('usuarioId', filtros.usuarioId);
    if (filtros.entidad) params = params.set('entidad', filtros.entidad);
    if (filtros.accion) params = params.set('accion', filtros.accion);
    if (filtros.desde) params = params.set('desde', filtros.desde);
    if (filtros.hasta) params = params.set('hasta', filtros.hasta);
    return this.http.get<Pagina<RegistroAuditoria>>(API, { params, context });
  }
}

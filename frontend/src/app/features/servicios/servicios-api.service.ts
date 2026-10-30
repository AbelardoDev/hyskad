import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { Pagina } from '../../core/http/pagina';

const API = '/api/v1/servicios';

/** Servicio del catálogo del taller (`ServicioResponse`). */
export interface Servicio {
  id: number;
  nombre: string;
  descripcion: string | null;
  precioBase: number;
  tiempoEstimadoMin: number;
  activo: boolean;
  createdAt: string;
}

export type DatosServicio = Pick<
  Servicio,
  'nombre' | 'descripcion' | 'precioBase' | 'tiempoEstimadoMin'
>;

/** Límite de `GuardarServicio.tiempoEstimadoMin` (una semana de trabajo continuo). */
export const MAX_MINUTOS = 10_080;

export interface FiltrosServicios {
  q: string;
  activo: boolean | null;
  page: number;
  size: number;
  sort: string | null;
}

/** Catálogo de servicios del taller (RF16). */
@Injectable({ providedIn: 'root' })
export class ServiciosApiService {
  private readonly http = inject(HttpClient);

  listar(filtros: FiltrosServicios, context?: HttpContext): Observable<Pagina<Servicio>> {
    let params = new HttpParams().set('page', filtros.page).set('size', filtros.size);
    if (filtros.q) params = params.set('q', filtros.q);
    if (filtros.activo !== null) params = params.set('activo', filtros.activo);
    if (filtros.sort) params = params.set('sort', filtros.sort);
    return this.http.get<Pagina<Servicio>>(API, { params, context });
  }

  crear(datos: DatosServicio, context?: HttpContext): Observable<Servicio> {
    return this.http.post<Servicio>(API, datos, { context });
  }

  actualizar(id: number, datos: DatosServicio, context?: HttpContext): Observable<Servicio> {
    return this.http.put<Servicio>(`${API}/${id}`, datos, { context });
  }

  cambiarEstado(id: number, activo: boolean): Observable<Servicio> {
    return this.http.patch<Servicio>(`${API}/${id}/estado`, { activo });
  }
}

import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { Pagina } from '../../core/http/pagina';
import { TipoDocumento } from '../../core/utils/validadores';

const API = '/api/v1/proveedores';

export interface Proveedor {
  id: number;
  tipoDocumento: TipoDocumento;
  numeroDocumento: string;
  razonSocial: string;
  contacto: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  activo: boolean;
  createdAt: string;
}

export type DatosProveedor = Omit<Proveedor, 'id' | 'activo' | 'createdAt'>;

export interface FiltrosProveedores {
  q: string;
  activo: boolean | null;
  page: number;
  size: number;
  sort: string | null;
}

/** Proveedores (RF20). */
@Injectable({ providedIn: 'root' })
export class ProveedoresApiService {
  private readonly http = inject(HttpClient);

  listar(filtros: FiltrosProveedores, context?: HttpContext): Observable<Pagina<Proveedor>> {
    let params = new HttpParams().set('page', filtros.page).set('size', filtros.size);
    if (filtros.q) params = params.set('q', filtros.q);
    if (filtros.activo !== null) params = params.set('activo', filtros.activo);
    if (filtros.sort) params = params.set('sort', filtros.sort);
    return this.http.get<Pagina<Proveedor>>(API, { params, context });
  }

  obtener(id: number, context?: HttpContext): Observable<Proveedor> {
    return this.http.get<Proveedor>(`${API}/${id}`, { context });
  }

  crear(datos: DatosProveedor, context?: HttpContext): Observable<Proveedor> {
    return this.http.post<Proveedor>(API, datos, { context });
  }

  actualizar(id: number, datos: DatosProveedor, context?: HttpContext): Observable<Proveedor> {
    return this.http.put<Proveedor>(`${API}/${id}`, datos, { context });
  }

  cambiarEstado(id: number, activo: boolean): Observable<Proveedor> {
    return this.http.patch<Proveedor>(`${API}/${id}/estado`, { activo });
  }
}

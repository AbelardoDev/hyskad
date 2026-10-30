import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { Pagina } from '../../core/http/pagina';
import { TipoDocumento } from '../../core/utils/validadores';

const API = '/api/v1/clientes';

/** Cliente en listados (`ClienteResumenResponse`): sin dirección ni autorización de datos. */
export interface ClienteResumen {
  id: number;
  tipoDocumento: TipoDocumento;
  numeroDocumento: string;
  nombreCompleto: string;
  telefono: string;
  email: string | null;
  cantidadMotos: number;
  activo: boolean;
}

/** Ficha completa (`ClienteResponse`). */
export interface Cliente extends ClienteResumen {
  nombres: string | null;
  apellidos: string | null;
  razonSocial: string | null;
  direccion: string | null;
  ciudad: string | null;
  aceptaTratamientoDatos: boolean;
  fechaAceptacionDatos: string | null;
  createdAt: string;
}

/** Cuerpo de crear y editar (`GuardarCliente`). */
export interface DatosCliente {
  tipoDocumento: TipoDocumento;
  numeroDocumento: string;
  nombres: string | null;
  apellidos: string | null;
  razonSocial: string | null;
  telefono: string;
  email: string | null;
  direccion: string | null;
  ciudad: string | null;
  aceptaTratamientoDatos: boolean;
}

export interface FiltrosClientes {
  q: string;
  activo: boolean | null;
  page: number;
  size: number;
  /** `campo,asc|desc` */
  sort: string | null;
}

/** Clientes (RF5, RF6, RF29). */
@Injectable({ providedIn: 'root' })
export class ClientesApiService {
  private readonly http = inject(HttpClient);

  listar(filtros: FiltrosClientes, context?: HttpContext): Observable<Pagina<ClienteResumen>> {
    let params = new HttpParams().set('page', filtros.page).set('size', filtros.size);
    if (filtros.q) params = params.set('q', filtros.q);
    if (filtros.activo !== null) params = params.set('activo', filtros.activo);
    if (filtros.sort) params = params.set('sort', filtros.sort);
    return this.http.get<Pagina<ClienteResumen>>(API, { params, context });
  }

  obtener(id: number, context?: HttpContext): Observable<Cliente> {
    return this.http.get<Cliente>(`${API}/${id}`, { context });
  }

  crear(datos: DatosCliente, context?: HttpContext): Observable<Cliente> {
    return this.http.post<Cliente>(API, datos, { context });
  }

  actualizar(id: number, datos: DatosCliente, context?: HttpContext): Observable<Cliente> {
    return this.http.put<Cliente>(`${API}/${id}`, datos, { context });
  }

  cambiarEstado(id: number, activo: boolean): Observable<Cliente> {
    return this.http.patch<Cliente>(`${API}/${id}/estado`, { activo });
  }
}

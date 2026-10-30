import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { Permiso, Rol } from '../../core/auth/permisos';
import { Idioma } from '../../core/i18n/language.service';

const API = '/api/v1/usuarios';

/** `PageResponse<T>` del backend. */
export interface Pagina<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

/** Usuario en la administración (`UsuarioResponse`). Nunca trae la contraseña. */
export interface Usuario {
  id: number;
  nombre: string;
  email: string;
  telefono: string | null;
  rol: Rol;
  activo: boolean;
  idioma: Idioma;
  ultimoAcceso: string | null;
  debeCambiarPassword: boolean;
  createdAt: string;
}

export interface FiltrosUsuarios {
  q: string;
  rol: Rol | null;
  activo: boolean | null;
  page: number;
  size: number;
  /** `campo,asc|desc` */
  sort: string | null;
}

export interface DatosUsuario {
  nombre: string;
  email: string;
  telefono: string | null;
  rol: Rol;
}

export interface NuevoUsuario extends DatosUsuario {
  password: string;
  idioma: Idioma;
}

/** Estado de un permiso para un usuario (`PermisoDeUsuario`). */
export interface PermisoDeUsuario {
  permiso: Permiso;
  delRol: boolean;
  ajuste: 'CONCEDIDO' | 'RETIRADO' | null;
  efectivo: boolean;
  editable: boolean;
  soloAdmin: boolean;
}

export interface AjustePermiso {
  permiso: Permiso;
  concedido: boolean;
}

/** Administración de usuarios, roles y permisos (RF1–RF4). */
@Injectable({ providedIn: 'root' })
export class UsuariosApiService {
  private readonly http = inject(HttpClient);

  listar(filtros: FiltrosUsuarios, context?: HttpContext): Observable<Pagina<Usuario>> {
    let params = new HttpParams().set('page', filtros.page).set('size', filtros.size);
    if (filtros.q) params = params.set('q', filtros.q);
    if (filtros.rol) params = params.set('rol', filtros.rol);
    if (filtros.activo !== null) params = params.set('activo', filtros.activo);
    if (filtros.sort) params = params.set('sort', filtros.sort);
    return this.http.get<Pagina<Usuario>>(API, { params, context });
  }

  obtener(id: number, context?: HttpContext): Observable<Usuario> {
    return this.http.get<Usuario>(`${API}/${id}`, { context });
  }

  crear(datos: NuevoUsuario, context?: HttpContext): Observable<Usuario> {
    return this.http.post<Usuario>(API, datos, { context });
  }

  actualizar(id: number, datos: DatosUsuario, context?: HttpContext): Observable<Usuario> {
    return this.http.put<Usuario>(`${API}/${id}`, datos, { context });
  }

  cambiarEstado(id: number, activo: boolean): Observable<Usuario> {
    return this.http.patch<Usuario>(`${API}/${id}/estado`, { activo });
  }

  permisos(id: number, context?: HttpContext): Observable<PermisoDeUsuario[]> {
    return this.http.get<PermisoDeUsuario[]>(`${API}/${id}/permisos`, { context });
  }

  actualizarPermisos(id: number, ajustes: AjustePermiso[]): Observable<PermisoDeUsuario[]> {
    return this.http.put<PermisoDeUsuario[]>(`${API}/${id}/permisos`, { ajustes });
  }
}

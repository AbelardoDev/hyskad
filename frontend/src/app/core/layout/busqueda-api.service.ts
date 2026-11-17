import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

/** Un resultado; `detalle` es una línea de contexto separada por " · " (documento, moto, estado…). */
export interface ItemBusqueda {
  id: number;
  titulo: string;
  detalle: string;
}

/** Hasta 5 resultados por tipo; un tipo que el usuario no puede ver llega vacío. */
export interface ResultadoBusqueda {
  clientes: ItemBusqueda[];
  motocicletas: ItemBusqueda[];
  ordenes: ItemBusqueda[];
  productos: ItemBusqueda[];
  ventas: ItemBusqueda[];
}

/** Mínimo de caracteres que acepta `GET /busqueda`. */
export const MINIMO_BUSQUEDA = 2;

/** Búsqueda global (RF29) para la paleta de comandos. */
@Injectable({ providedIn: 'root' })
export class BusquedaApiService {
  private readonly http = inject(HttpClient);

  buscar(q: string, context?: HttpContext): Observable<ResultadoBusqueda> {
    return this.http.get<ResultadoBusqueda>('/api/v1/busqueda', {
      params: new HttpParams().set('q', q),
      context,
    });
  }
}

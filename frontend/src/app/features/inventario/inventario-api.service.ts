import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { Pagina } from '../../core/http/pagina';

export const UNIDADES = ['UNIDAD', 'LITRO', 'GALON', 'KIT', 'PAR', 'METRO'] as const;
export type Unidad = (typeof UNIDADES)[number];

export type EstadoStock = 'OK' | 'BAJO' | 'AGOTADO';

export const TIPOS_MOVIMIENTO = [
  'ENTRADA_COMPRA',
  'SALIDA_VENTA',
  'SALIDA_ORDEN',
  'ENTRADA_AJUSTE',
  'SALIDA_AJUSTE',
  'DEVOLUCION_ANULACION_VENTA',
  'SALIDA_ANULACION_COMPRA',
] as const;
export type TipoMovimiento = (typeof TIPOS_MOVIMIENTO)[number];

/** Las entradas suman existencias; las demás las restan. */
export const ES_ENTRADA: Record<TipoMovimiento, boolean> = {
  ENTRADA_COMPRA: true,
  SALIDA_VENTA: false,
  SALIDA_ORDEN: false,
  ENTRADA_AJUSTE: true,
  SALIDA_AJUSTE: false,
  DEVOLUCION_ANULACION_VENTA: true,
  SALIDA_ANULACION_COMPRA: false,
};

export interface Categoria {
  id: number;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
}

/** Cantidades y montos llegan como número (BigDecimal de Jackson). */
export interface Producto {
  id: number;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  marca: string | null;
  categoria: { id: number; nombre: string };
  unidad: Unidad;
  precioVenta: number;
  /** Solo viene para quien tiene `PRODUCTOS_GESTIONAR`. */
  costoPromedio?: number;
  stockActual: number;
  stockReservado: number;
  stockDisponible: number;
  stockMinimo: number;
  estadoStock: EstadoStock;
  activo: boolean;
  createdAt: string;
}

export interface DatosProducto {
  codigo: string;
  nombre: string;
  descripcion: string | null;
  marca: string | null;
  categoriaId: number;
  unidad: Unidad;
  precioVenta: number;
  stockMinimo: number;
}

export interface Movimiento {
  id: number;
  fecha: string;
  tipo: TipoMovimiento;
  cantidad: number;
  costoUnitario: number;
  stockResultante: number;
  producto: { id: number; codigo: string; nombre: string; unidad: Unidad };
  referencia: {
    tipo: 'COMPRA' | 'VENTA' | 'ORDEN_TRABAJO';
    id: number | null;
    numero: string | null;
  } | null;
  motivo: string | null;
  usuario: { id: number; nombre: string } | null;
}

export interface Ajuste {
  productoId: number;
  tipo: 'ENTRADA' | 'SALIDA';
  cantidad: number;
  costoUnitario: number | null;
  motivo: string;
}

export interface FiltrosProductos {
  q: string;
  categoriaId: number | null;
  activo: boolean | null;
  soloStockBajo: boolean;
  page: number;
  size: number;
  sort: string | null;
}

export interface FiltrosMovimientos {
  productoId: number | null;
  tipo: TipoMovimiento | null;
  /** ISO-8601 UTC; `desde` incluido y `hasta` excluido. */
  desde: string | null;
  hasta: string | null;
  page: number;
  size: number;
}

const PRODUCTOS = '/api/v1/productos';
const CATEGORIAS = '/api/v1/categorias';
const INVENTARIO = '/api/v1/inventario';

/** Catálogo e inventario (RF17, RF18, RF29). */
@Injectable({ providedIn: 'root' })
export class InventarioApiService {
  private readonly http = inject(HttpClient);

  productos(filtros: FiltrosProductos, context?: HttpContext): Observable<Pagina<Producto>> {
    let params = new HttpParams().set('page', filtros.page).set('size', filtros.size);
    if (filtros.q) params = params.set('q', filtros.q);
    if (filtros.categoriaId !== null) params = params.set('categoriaId', filtros.categoriaId);
    if (filtros.activo !== null) params = params.set('activo', filtros.activo);
    if (filtros.soloStockBajo) params = params.set('soloStockBajo', true);
    if (filtros.sort) params = params.set('sort', filtros.sort);
    return this.http.get<Pagina<Producto>>(PRODUCTOS, { params, context });
  }

  producto(id: number, context?: HttpContext): Observable<Producto> {
    return this.http.get<Producto>(`${PRODUCTOS}/${id}`, { context });
  }

  crearProducto(datos: DatosProducto, context?: HttpContext): Observable<Producto> {
    return this.http.post<Producto>(PRODUCTOS, datos, { context });
  }

  actualizarProducto(
    id: number,
    datos: DatosProducto,
    context?: HttpContext,
  ): Observable<Producto> {
    return this.http.put<Producto>(`${PRODUCTOS}/${id}`, datos, { context });
  }

  cambiarEstadoProducto(id: number, activo: boolean): Observable<Producto> {
    return this.http.patch<Producto>(`${PRODUCTOS}/${id}/estado`, { activo });
  }

  categorias(activo: boolean | null, context?: HttpContext): Observable<Categoria[]> {
    const params = activo === null ? undefined : new HttpParams().set('activo', activo);
    return this.http.get<Categoria[]>(CATEGORIAS, { params, context });
  }

  crearCategoria(
    datos: { nombre: string; descripcion: string | null },
    context?: HttpContext,
  ): Observable<Categoria> {
    return this.http.post<Categoria>(CATEGORIAS, datos, { context });
  }

  actualizarCategoria(
    id: number,
    datos: { nombre: string; descripcion: string | null },
    context?: HttpContext,
  ): Observable<Categoria> {
    return this.http.put<Categoria>(`${CATEGORIAS}/${id}`, datos, { context });
  }

  cambiarEstadoCategoria(id: number, activo: boolean): Observable<Categoria> {
    return this.http.patch<Categoria>(`${CATEGORIAS}/${id}/estado`, { activo });
  }

  movimientos(filtros: FiltrosMovimientos, context?: HttpContext): Observable<Pagina<Movimiento>> {
    const params = paramsMovimientos(filtros).set('page', filtros.page).set('size', filtros.size);
    return this.http.get<Pagina<Movimiento>>(`${INVENTARIO}/movimientos`, { params, context });
  }

  /** CSV con los mismos filtros (máximo 10 000 filas). */
  exportarMovimientos(filtros: FiltrosMovimientos): Observable<Blob> {
    return this.http.get(`${INVENTARIO}/movimientos/exportar`, {
      params: paramsMovimientos(filtros),
      responseType: 'blob',
    });
  }

  ajustar(datos: Ajuste, context?: HttpContext): Observable<Movimiento> {
    return this.http.post<Movimiento>(`${INVENTARIO}/ajustes`, datos, { context });
  }
}

function paramsMovimientos(filtros: FiltrosMovimientos): HttpParams {
  let params = new HttpParams();
  if (filtros.productoId !== null) params = params.set('productoId', filtros.productoId);
  if (filtros.tipo) params = params.set('tipo', filtros.tipo);
  if (filtros.desde) params = params.set('desde', filtros.desde);
  if (filtros.hasta) params = params.set('hasta', filtros.hasta);
  return params;
}

import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { Pagina } from '../../core/http/pagina';
import { Unidad } from '../inventario/inventario-api.service';

const API = '/api/v1/compras';

export type EstadoCompra = 'REGISTRADA' | 'ANULADA';

interface ProveedorCompra {
  id: number;
  razonSocial: string;
  numeroDocumento: string;
}

export interface CompraResumen {
  id: number;
  numero: string;
  proveedor: ProveedorCompra;
  numeroFacturaProveedor: string;
  /** `aaaa-mm-dd` (fecha de la factura). */
  fecha: string;
  total: number;
  estado: EstadoCompra;
}

export interface ItemCompra {
  id: number;
  /** Con el stock y el costo promedio actuales del producto. */
  producto: {
    id: number;
    codigo: string;
    nombre: string;
    unidad: Unidad;
    stockActual: number;
    stockDisponible: number;
    costoPromedio: number;
  };
  cantidad: number;
  costoUnitario: number;
  subtotal: number;
}

export interface Compra extends CompraResumen {
  subtotal: number;
  ivaPorcentaje: number;
  impuesto: number;
  items: ItemCompra[];
  registradaPor: { id: number; nombre: string } | null;
  createdAt: string;
  motivoAnulacion: string | null;
  anuladaPor: { id: number; nombre: string } | null;
  anuladaEn: string | null;
}

export interface NuevaCompra {
  proveedorId: number;
  numeroFacturaProveedor: string;
  fecha: string;
  items: { productoId: number; cantidad: number; costoUnitario: number }[];
}

export interface FiltrosCompras {
  proveedorId: number | null;
  desde: string | null;
  hasta: string | null;
  estado: EstadoCompra | null;
  numero: string;
  page: number;
  size: number;
}

/** Compras a proveedores (RF21). */
@Injectable({ providedIn: 'root' })
export class ComprasApiService {
  private readonly http = inject(HttpClient);

  listar(filtros: FiltrosCompras, context?: HttpContext): Observable<Pagina<CompraResumen>> {
    let params = new HttpParams().set('page', filtros.page).set('size', filtros.size);
    if (filtros.proveedorId !== null) params = params.set('proveedorId', filtros.proveedorId);
    if (filtros.desde) params = params.set('desde', filtros.desde);
    if (filtros.hasta) params = params.set('hasta', filtros.hasta);
    if (filtros.estado) params = params.set('estado', filtros.estado);
    if (filtros.numero) params = params.set('numero', filtros.numero);
    return this.http.get<Pagina<CompraResumen>>(API, { params, context });
  }

  obtener(id: number, context?: HttpContext): Observable<Compra> {
    return this.http.get<Compra>(`${API}/${id}`, { context });
  }

  registrar(datos: NuevaCompra, context?: HttpContext): Observable<Compra> {
    return this.http.post<Compra>(API, datos, { context });
  }

  /** IVA vigente (RN-03) para mostrar los totales antes de registrar. */
  iva(context?: HttpContext): Observable<{ porcentaje: number }> {
    return this.http.get<{ porcentaje: number }>('/api/v1/configuracion/iva', { context });
  }

  anular(id: number, motivo: string): Observable<Compra> {
    return this.http.post<Compra>(`${API}/${id}/anulacion`, { motivo });
  }
}

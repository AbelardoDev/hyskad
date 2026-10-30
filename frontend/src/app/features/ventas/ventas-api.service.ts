import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { Pagina } from '../../core/http/pagina';
import { TipoDocumento } from '../../core/utils/validadores';
import { Unidad } from '../inventario/inventario-api.service';

const API = '/api/v1/ventas';

export const METODOS_PAGO = ['EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'OTRO'] as const;
export type MetodoPago = (typeof METODOS_PAGO)[number];
export type EstadoVenta = 'PAGADA' | 'ANULADA';

interface UsuarioVenta {
  id: number;
  nombre: string;
}

export interface VentaResumen {
  id: number;
  numero: string;
  fecha: string;
  /** Nombre del cliente; `null` es consumidor final (RN-18). */
  cliente: string | null;
  vendedor: UsuarioVenta | null;
  metodoPago: MetodoPago;
  total: number;
  estado: EstadoVenta;
}

export interface ItemVenta {
  id: number;
  productoId: number;
  codigo: string;
  nombre: string;
  unidad: Unidad;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
}

export interface Venta {
  id: number;
  numero: string;
  fecha: string;
  cliente: {
    id: number;
    nombreCompleto: string;
    tipoDocumento: TipoDocumento;
    numeroDocumento: string;
    telefono: string;
  } | null;
  items: ItemVenta[];
  subtotal: number;
  descuento: number;
  ivaPorcentaje: number;
  impuesto: number;
  total: number;
  metodoPago: MetodoPago;
  referenciaPago: string | null;
  montoRecibido: number | null;
  cambio: number | null;
  estado: EstadoVenta;
  vendedor: UsuarioVenta | null;
  motivoAnulacion: string | null;
  anuladaPor: UsuarioVenta | null;
  anuladaEn: string | null;
}

export interface Comprobante {
  taller: { nombre: string; nit: string; direccion: string; telefono: string };
  venta: Venta;
  /** RN-06: "Documento interno. No es factura electrónica." */
  leyenda: string;
}

/** La petición no lleva precios: el backend usa el precio de venta vigente. */
export interface NuevaVenta {
  clienteId: number | null;
  items: { productoId: number; cantidad: number }[];
  descuento: number;
  metodoPago: MetodoPago;
  referenciaPago: string | null;
  montoRecibido: number | null;
}

export interface FiltrosVentas {
  desde: string | null;
  hasta: string | null;
  vendedorId: number | null;
  metodo: MetodoPago | null;
  estado: EstadoVenta | null;
  numero: string;
  page: number;
  size: number;
}

/** Ventas de mostrador y comprobantes (RN-18 a RN-21, RF27). */
@Injectable({ providedIn: 'root' })
export class VentasApiService {
  private readonly http = inject(HttpClient);

  listar(filtros: FiltrosVentas, context?: HttpContext): Observable<Pagina<VentaResumen>> {
    const params = paramsFiltros(filtros).set('page', filtros.page).set('size', filtros.size);
    return this.http.get<Pagina<VentaResumen>>(API, { params, context });
  }

  /** Cantidad y total con los mismos filtros (sin paginar). */
  resumen(
    filtros: FiltrosVentas,
    context?: HttpContext,
  ): Observable<{ cantidad: number; total: number }> {
    return this.http.get<{ cantidad: number; total: number }>(`${API}/resumen`, {
      params: paramsFiltros(filtros),
      context,
    });
  }

  obtener(id: number, context?: HttpContext): Observable<Venta> {
    return this.http.get<Venta>(`${API}/${id}`, { context });
  }

  comprobante(id: number, context?: HttpContext): Observable<Comprobante> {
    return this.http.get<Comprobante>(`${API}/${id}/comprobante`, { context });
  }

  registrar(datos: NuevaVenta, context?: HttpContext): Observable<Venta> {
    return this.http.post<Venta>(API, datos, { context });
  }

  anular(id: number, motivo: string): Observable<Venta> {
    return this.http.post<Venta>(`${API}/${id}/anulacion`, { motivo });
  }
}

function paramsFiltros(filtros: FiltrosVentas): HttpParams {
  let params = new HttpParams();
  if (filtros.desde) params = params.set('desde', filtros.desde);
  if (filtros.hasta) params = params.set('hasta', filtros.hasta);
  if (filtros.vendedorId !== null) params = params.set('vendedorId', filtros.vendedorId);
  if (filtros.metodo) params = params.set('metodo', filtros.metodo);
  if (filtros.estado) params = params.set('estado', filtros.estado);
  if (filtros.numero) params = params.set('numero', filtros.numero);
  return params;
}

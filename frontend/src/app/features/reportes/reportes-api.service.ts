import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { Pagina } from '../../core/http/pagina';
import { MetodoPago } from '../../shared/ui/forms/campos-pago';

const API = '/api/v1/reportes';

/** Orden finalizada sin pago (RN-37) con los días desde la finalización. */
export interface CuentaPendiente {
  ordenId: number;
  numero: string;
  clienteId: number;
  cliente: string;
  telefono: string;
  placa: string;
  moto: string;
  fechaFinalizacion: string;
  diasTranscurridos: number;
  total: number;
}

export interface CuentasPendientes {
  cuentas: Pagina<CuentaPendiente>;
  /** Lo que se debe en todo el resultado filtrado, no solo en la página. */
  totalAdeudado: number;
}

export interface FiltrosCuentasPendientes {
  clienteId: number | null;
  desde: string | null;
  hasta: string | null;
  page: number;
  size: number;
}

/** Periodo de un reporte en días de Bogotá (`aaaa-mm-dd`, ambos inclusivos). */
export interface Periodo {
  desde: string;
  hasta: string;
}

export type Reporte = 'servicios' | 'inventario' | 'ventas';

/** RF32. Montos sin IVA ni descuento salvo `total`. */
export interface ReporteServicios {
  ordenes: number;
  servicios: number;
  ingresosManoObra: number;
  ingresosRepuestos: number;
  horasPromedioEnTaller: number;
  porServicio: { nombre: string; cantidad: number; ingresos: number }[];
  detalle: {
    ordenId: number;
    numero: string;
    fechaFinalizacion: string;
    placa: string;
    cliente: string;
    mecanicos: string;
    servicios: number;
    manoObra: number;
    repuestos: number;
    total: number;
    horasEnTaller: number;
  }[];
}

export interface FiltrosReporteServicios extends Periodo {
  servicioId: number | null;
  mecanicoId: number | null;
}

/** Nivel de stock según el backend (`NORMAL`, `BAJO`, `AGOTADO`). */
export type NivelInventario = 'NORMAL' | 'BAJO' | 'AGOTADO';

/** RF33: existencias valorizadas a costo promedio y movimientos del periodo. */
export interface ReporteInventario {
  productos: number;
  unidades: number;
  valorInventario: number;
  conStockBajo: number;
  agotados: number;
  detalle: {
    id: number;
    codigo: string;
    nombre: string;
    categoria: string;
    unidad: string;
    stockActual: number;
    disponible: number;
    minimo: number;
    costoPromedio: number;
    valor: number;
    nivel: NivelInventario;
  }[];
  movimientos: { tipo: string; cantidad: number; unidades: number; valor: number }[];
}

export interface FiltrosReporteInventario extends Periodo {
  categoriaId: number | null;
}

/** Ventas pagadas del periodo con utilidad bruta (precio − costo congelado). */
export interface ReporteVentas {
  ventas: number;
  subtotal: number;
  descuento: number;
  impuesto: number;
  total: number;
  costo: number;
  utilidadBruta: number;
  margenPorcentaje: number;
  porDia: { clave: string; valor: number }[];
  porMetodo: { clave: string; valor: number }[];
  detalle: {
    ventaId: number;
    numero: string;
    fecha: string;
    vendedor: string;
    metodo: MetodoPago;
    total: number;
    costo: number;
    utilidad: number;
  }[];
}

export interface FiltrosReporteVentas extends Periodo {
  vendedorId: number | null;
  metodo: MetodoPago | null;
}

/** Filtros sin valor no se envían. */
function aParams(filtros: object): HttpParams {
  let params = new HttpParams();
  for (const [clave, valor] of Object.entries(filtros)) {
    if (valor !== null && valor !== undefined && valor !== '') params = params.set(clave, valor);
  }
  return params;
}

/** Nombre del CSV, igual al que propone el backend. */
export function nombreCsv(reporte: Reporte, periodo: Periodo): string {
  return `reporte-${reporte}-${periodo.desde}-a-${periodo.hasta}.csv`;
}

/** Reportes (RF26, RF32, RF33 y ventas). Cada uno exige además el permiso de su área. */
@Injectable({ providedIn: 'root' })
export class ReportesApiService {
  private readonly http = inject(HttpClient);

  cuentasPendientes(
    filtros: FiltrosCuentasPendientes,
    context?: HttpContext,
  ): Observable<CuentasPendientes> {
    let params = new HttpParams().set('page', filtros.page).set('size', filtros.size);
    if (filtros.clienteId !== null) params = params.set('clienteId', filtros.clienteId);
    if (filtros.desde) params = params.set('desde', filtros.desde);
    if (filtros.hasta) params = params.set('hasta', filtros.hasta);
    return this.http.get<CuentasPendientes>(`${API}/cuentas-pendientes`, { params, context });
  }

  servicios(filtros: FiltrosReporteServicios, context?: HttpContext): Observable<ReporteServicios> {
    return this.http.get<ReporteServicios>(`${API}/servicios`, {
      params: aParams(filtros),
      context,
    });
  }

  inventario(
    filtros: FiltrosReporteInventario,
    context?: HttpContext,
  ): Observable<ReporteInventario> {
    return this.http.get<ReporteInventario>(`${API}/inventario`, {
      params: aParams(filtros),
      context,
    });
  }

  ventas(filtros: FiltrosReporteVentas, context?: HttpContext): Observable<ReporteVentas> {
    return this.http.get<ReporteVentas>(`${API}/ventas`, { params: aParams(filtros), context });
  }

  /** El mismo reporte en CSV (UTF-8 con BOM, separador `;`). */
  exportar(reporte: Reporte, filtros: Periodo): Observable<Blob> {
    return this.http.get(`${API}/${reporte}`, {
      params: aParams({ ...filtros, formato: 'csv' }),
      responseType: 'blob',
    });
  }
}

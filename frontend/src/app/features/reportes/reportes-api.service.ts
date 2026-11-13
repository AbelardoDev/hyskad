import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { Pagina } from '../../core/http/pagina';

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

/** Reportes (RF26; el resto llega en F11). */
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
}

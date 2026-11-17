import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { EstadoOrden } from '../../shared/ui/badge/status-badge';

/** Panel de control (`GET /dashboard`); un bloque sin permiso llega en `null` o vacío. */
export interface Dashboard {
  vista: 'GENERAL' | 'MECANICO';
  desde: string;
  hasta: string;
  kpis: {
    ventasHoyCantidad: number | null;
    ventasHoyTotal: number | null;
    ingresosOrdenesHoy: number | null;
    ordenesActivas: number | null;
    pendientesAprobacion: number | null;
    porCobrar: number | null;
    productosStockBajo: number | null;
    finalizadasMes: number | null;
  };
  ingresosDiarios: { dia: string; ventas: number; ordenes: number }[];
  ordenesPorEstado: Partial<Record<EstadoOrden, number>>;
  topServicios: { nombre: string; cantidad: number; ingresos: number | null }[];
  topRepuestos: { nombre: string; cantidad: number; ingresos: number | null }[];
  ultimasOrdenes: {
    id: number;
    numero: string;
    estado: EstadoOrden;
    placa: string;
    moto: string;
    cliente: string;
    actualizada: string;
  }[];
  stockCritico: {
    id: number;
    codigo: string;
    nombre: string;
    unidad: string;
    disponible: number;
    minimo: number;
  }[];
}

@Injectable({ providedIn: 'root' })
export class DashboardApiService {
  private readonly http = inject(HttpClient);

  obtener(
    desde: string | null,
    hasta: string | null,
    context?: HttpContext,
  ): Observable<Dashboard> {
    let params = new HttpParams();
    if (desde) params = params.set('desde', desde);
    if (hasta) params = params.set('hasta', hasta);
    return this.http.get<Dashboard>('/api/v1/dashboard', { params, context });
  }
}

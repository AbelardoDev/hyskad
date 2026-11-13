import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { Pagina } from '../../core/http/pagina';
import { EstadoOrden } from '../../shared/ui/badge/status-badge';

const API = '/api/v1/motocicletas';

/** Moto con su ficha y el propietario actual (`MotocicletaResponse`). */
export interface Motocicleta {
  id: number;
  placa: string;
  marca: string;
  modelo: string;
  anio: number | null;
  vin: string | null;
  cilindradaCc: number | null;
  color: string | null;
  activo: boolean;
  propietario: { id: number; nombreCompleto: string; activo: boolean };
  createdAt: string;
}

/** Ficha técnica editable (`ActualizarMotocicleta`). */
export interface FichaMotocicleta {
  placa: string;
  marca: string;
  modelo: string;
  anio: number | null;
  vin: string | null;
  cilindradaCc: number | null;
  color: string | null;
}

export interface NuevaMotocicleta extends FichaMotocicleta {
  clienteId: number;
}

/** Una orden en el historial de la moto (`HistorialServicio`, RF9). Sin costos. */
export interface HistorialServicio {
  ordenId: number;
  numero: string;
  estado: EstadoOrden;
  fechaIngreso: string;
  fechaFinalizacion: string | null;
  fechaEntrega: string | null;
  kilometrajeIngreso: number;
  kilometrajeInspeccion: number | null;
  motivoIngreso: string;
  diagnostico: string | null;
  servicios: { descripcion: string; precio: number }[];
  repuestos: {
    codigo: string;
    nombre: string;
    cantidad: number;
    precioUnitario: number;
    subtotal: number;
  }[];
  total: number;
  mecanicos: string[];
}

export interface FiltrosMotocicletas {
  placa: string;
  marca: string;
  activo: boolean | null;
  page: number;
  size: number;
  sort: string | null;
}

/** Motocicletas (RF7–RF9, RF29). */
@Injectable({ providedIn: 'root' })
export class MotocicletasApiService {
  private readonly http = inject(HttpClient);

  listar(filtros: FiltrosMotocicletas, context?: HttpContext): Observable<Pagina<Motocicleta>> {
    let params = new HttpParams().set('page', filtros.page).set('size', filtros.size);
    if (filtros.placa) params = params.set('placa', filtros.placa);
    if (filtros.marca) params = params.set('marca', filtros.marca);
    if (filtros.activo !== null) params = params.set('activo', filtros.activo);
    if (filtros.sort) params = params.set('sort', filtros.sort);
    return this.http.get<Pagina<Motocicleta>>(API, { params, context });
  }

  delCliente(clienteId: number, context?: HttpContext): Observable<Motocicleta[]> {
    return this.http.get<Motocicleta[]>(`/api/v1/clientes/${clienteId}/motocicletas`, { context });
  }

  obtener(id: number, context?: HttpContext): Observable<Motocicleta> {
    return this.http.get<Motocicleta>(`${API}/${id}`, { context });
  }

  /** RF9: la más reciente primero; las canceladas solo si se piden. */
  historial(
    id: number,
    consulta: { incluirCanceladas: boolean; page: number; size: number },
    context?: HttpContext,
  ): Observable<Pagina<HistorialServicio>> {
    const params = new HttpParams()
      .set('incluirCanceladas', consulta.incluirCanceladas)
      .set('page', consulta.page)
      .set('size', consulta.size);
    return this.http.get<Pagina<HistorialServicio>>(`${API}/${id}/historial`, { params, context });
  }

  crear(datos: NuevaMotocicleta, context?: HttpContext): Observable<Motocicleta> {
    return this.http.post<Motocicleta>(API, datos, { context });
  }

  actualizar(id: number, datos: FichaMotocicleta, context?: HttpContext): Observable<Motocicleta> {
    return this.http.put<Motocicleta>(`${API}/${id}`, datos, { context });
  }

  cambiarEstado(id: number, activo: boolean): Observable<Motocicleta> {
    return this.http.patch<Motocicleta>(`${API}/${id}/estado`, { activo });
  }

  cambiarPropietario(
    id: number,
    clienteId: number,
    context?: HttpContext,
  ): Observable<Motocicleta> {
    return this.http.patch<Motocicleta>(`${API}/${id}/propietario`, { clienteId }, { context });
  }
}

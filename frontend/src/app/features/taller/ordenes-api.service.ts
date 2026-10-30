import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { Pagina } from '../../core/http/pagina';
import { TipoDocumento } from '../../core/utils/validadores';
import { EstadoOrden } from '../../shared/ui/badge/status-badge';

const API = '/api/v1/ordenes-trabajo';

/** Límites de los comandos del backend (`OrdenTrabajoService`). */
export const MAX_KILOMETRAJE = 9_999_999;
export const MAX_MECANICOS = 10;

/** Todos los estados, en el orden del flujo (columnas del kanban). */
export const ESTADOS_ORDEN: readonly EstadoOrden[] = [
  'RECIBIDA',
  'EN_DIAGNOSTICO',
  'PENDIENTE_APROBACION',
  'EN_REPARACION',
  'FINALIZADA',
  'ENTREGADA',
  'CANCELADA',
];

export interface UsuarioResumen {
  id: number;
  nombre: string;
}

/** Orden en el tablero (`OrdenResumenResponse`). */
export interface OrdenResumen {
  id: number;
  numero: string;
  estado: EstadoOrden;
  fechaIngreso: string;
  placa: string;
  moto: string;
  cliente: string;
  mecanicos: UsuarioResumen[];
}

/**
 * Transición que el usuario actual puede pedir. Con `bloqueo` existe pero aún no se cumple su
 * condición (`SIN_MECANICOS`, `SIN_DIAGNOSTICO`, `SIN_ITEMS`, `SIN_PAGO`).
 */
export interface TransicionPermitida {
  estado: EstadoOrden;
  requiereNota: boolean;
  bloqueo: string | null;
}

/** Lo que el usuario actual puede hacer con la orden; lo calcula el backend. */
export interface AccionesPermitidas {
  editar: boolean;
  asignarMecanicos: boolean;
  registrarDiagnostico: boolean;
  transiciones: TransicionPermitida[];
}

/** Detalle de la orden (`OrdenResponse`). */
export interface Orden {
  id: number;
  numero: string;
  estado: EstadoOrden;
  version: number;
  fechaIngreso: string;
  kilometrajeIngreso: number;
  motivoIngreso: string;
  descripcionProblema: string;
  observaciones: string | null;
  diagnostico: string | null;
  observacionesDiagnostico: string | null;
  kilometrajeInspeccion: number | null;
  cliente: {
    id: number;
    nombreCompleto: string;
    tipoDocumento: TipoDocumento;
    numeroDocumento: string;
    telefono: string;
  };
  motocicleta: {
    id: number;
    placa: string;
    marca: string;
    modelo: string;
    anio: number | null;
    color: string | null;
  };
  mecanicos: { id: number; nombre: string; actividad: string | null; asignadoEn: string }[];
  historial: {
    estadoAnterior: EstadoOrden | null;
    estadoNuevo: EstadoOrden;
    nota: string | null;
    usuario: UsuarioResumen | null;
    fecha: string;
  }[];
  creadaPor: UsuarioResumen | null;
  accionesPermitidas: AccionesPermitidas;
}

export interface AsignacionMecanico {
  mecanicoId: number;
  actividad: string | null;
}

export interface DatosRecepcion {
  motivoIngreso: string;
  descripcionProblema: string;
  observaciones: string | null;
}

export interface NuevaOrden extends DatosRecepcion {
  clienteId: number;
  motocicletaId: number;
  kilometrajeIngreso: number;
  mecanicos: AsignacionMecanico[];
}

export interface DatosDiagnostico {
  diagnostico: string;
  observaciones: string | null;
  kilometrajeInspeccion: number | null;
}

/** Lo que la recepción necesita saber de una moto (RN-24, RN-25). */
export interface InfoRecepcion {
  ultimoKilometraje: number | null;
  ordenActiva: { id: number; numero: string; estado: EstadoOrden } | null;
}

export interface FiltrosOrdenes {
  q: string;
  estados: EstadoOrden[];
  mecanicoId: number | null;
  desde: string | null;
  hasta: string | null;
  page: number;
  size: number;
  sort: string | null;
}

/** Órdenes de trabajo (RF10–RF14, RF29). */
@Injectable({ providedIn: 'root' })
export class OrdenesApiService {
  private readonly http = inject(HttpClient);

  listar(filtros: FiltrosOrdenes, context?: HttpContext): Observable<Pagina<OrdenResumen>> {
    return this.http.get<Pagina<OrdenResumen>>(API, { params: parametros(filtros), context });
  }

  /** "Mis órdenes": las asignadas al usuario actual. */
  mias(filtros: FiltrosOrdenes, context?: HttpContext): Observable<Pagina<OrdenResumen>> {
    return this.http.get<Pagina<OrdenResumen>>(`${API}/mias`, {
      params: parametros(filtros),
      context,
    });
  }

  resumenEstados(context?: HttpContext): Observable<Record<EstadoOrden, number>> {
    return this.http.get<Record<EstadoOrden, number>>(`${API}/resumen-estados`, { context });
  }

  recepcion(motocicletaId: number, context?: HttpContext): Observable<InfoRecepcion> {
    return this.http.get<InfoRecepcion>(`${API}/recepcion`, {
      params: new HttpParams().set('motocicletaId', motocicletaId),
      context,
    });
  }

  obtener(id: number, context?: HttpContext): Observable<Orden> {
    return this.http.get<Orden>(`${API}/${id}`, { context });
  }

  crear(datos: NuevaOrden, context?: HttpContext): Observable<Orden> {
    return this.http.post<Orden>(API, datos, { context });
  }

  actualizar(orden: Orden, datos: DatosRecepcion, context?: HttpContext): Observable<Orden> {
    return this.http.put<Orden>(
      `${API}/${orden.id}`,
      { version: orden.version, ...datos },
      { context },
    );
  }

  asignarMecanicos(
    orden: Orden,
    mecanicos: AsignacionMecanico[],
    context?: HttpContext,
  ): Observable<Orden> {
    return this.http.put<Orden>(
      `${API}/${orden.id}/mecanicos`,
      { version: orden.version, mecanicos },
      { context },
    );
  }

  registrarDiagnostico(
    orden: Orden,
    datos: DatosDiagnostico,
    context?: HttpContext,
  ): Observable<Orden> {
    return this.http.put<Orden>(
      `${API}/${orden.id}/diagnostico`,
      { version: orden.version, ...datos },
      { context },
    );
  }

  transicionar(orden: Orden, estado: EstadoOrden, nota: string | null): Observable<Orden> {
    return this.http.post<Orden>(`${API}/${orden.id}/transiciones`, {
      version: orden.version,
      estado,
      nota,
    });
  }

  /** Mecánicos activos para asignar y filtrar (`GET /usuarios/mecanicos`). */
  mecanicos(context?: HttpContext): Observable<UsuarioResumen[]> {
    return this.http.get<UsuarioResumen[]>('/api/v1/usuarios/mecanicos', { context });
  }
}

function parametros(filtros: FiltrosOrdenes): HttpParams {
  let params = new HttpParams().set('page', filtros.page).set('size', filtros.size);
  if (filtros.q) params = params.set('q', filtros.q);
  for (const estado of filtros.estados) params = params.append('estado', estado);
  if (filtros.mecanicoId !== null) params = params.set('mecanicoId', filtros.mecanicoId);
  if (filtros.desde) params = params.set('desde', filtros.desde);
  if (filtros.hasta) params = params.set('hasta', filtros.hasta);
  if (filtros.sort) params = params.set('sort', filtros.sort);
  return params;
}

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
  /** Agregar, editar o quitar servicios y repuestos (solo en diagnóstico, RN-28). */
  editarItems: boolean;
  /** Enviar, decidir y retirar presupuestos. */
  gestionarPresupuestos: boolean;
  transiciones: TransicionPermitida[];
}

/** Servicio de la orden; sin `servicioId` es mano de obra libre (RN-30). */
export interface ServicioOrden {
  id: number;
  servicioId: number | null;
  descripcion: string;
  precio: number;
  tiempoMin: number | null;
  mecanico: UsuarioResumen | null;
}

/** Repuesto reservado (RN-29) con el disponible actual del producto. */
export interface RepuestoOrden {
  id: number;
  productoId: number;
  codigo: string;
  nombre: string;
  unidad: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
  stockDisponible: number;
  stockMinimo: number;
}

export type EstadoPresupuesto = 'PENDIENTE' | 'APROBADO' | 'RECHAZADO' | 'REEMPLAZADO';

/** Presupuesto con ítems y totales congelados (RN-31). */
export interface Presupuesto {
  id: number;
  ordenId: number;
  numero: string;
  version: number;
  estado: EstadoPresupuesto;
  items: {
    tipo: 'SERVICIO' | 'REPUESTO';
    descripcion: string;
    cantidad: number;
    precioUnitario: number;
    subtotal: number;
  }[];
  subtotal: number;
  descuento: number;
  ivaPorcentaje: number;
  impuesto: number;
  total: number;
  observaciones: string | null;
  fechaEnvio: string;
  enviadoPor: UsuarioResumen | null;
  fechaDecision: string | null;
  decididoPor: UsuarioResumen | null;
  observacionesDecision: string | null;
}

/** Presupuesto imprimible con el taller, el cliente y la moto. */
export interface DocumentoPresupuesto {
  taller: { nombre: string; nit: string; direccion: string; telefono: string };
  numeroOrden: string;
  cliente: {
    nombreCompleto: string;
    tipoDocumento: TipoDocumento;
    numeroDocumento: string;
    telefono: string;
  };
  moto: { placa: string; marca: string; modelo: string; anio: number | null };
  presupuesto: Presupuesto;
  leyenda: string;
}

export interface DatosServicioOrden {
  servicioId: number | null;
  descripcion: string | null;
  precio: number | null;
  tiempoMin: number | null;
  mecanicoId: number | null;
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
  servicios: ServicioOrden[];
  repuestos: RepuestoOrden[];
  subtotal: number;
  descuento: number;
  ivaPorcentaje: number;
  impuesto: number;
  total: number;
  fechaFinalizacion: string | null;
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

  agregarServicio(
    orden: Orden,
    datos: DatosServicioOrden,
    context?: HttpContext,
  ): Observable<Orden> {
    return this.http.post<Orden>(
      `${API}/${orden.id}/servicios`,
      { version: orden.version, ...datos },
      { context },
    );
  }

  actualizarServicio(
    orden: Orden,
    itemId: number,
    datos: DatosServicioOrden,
    context?: HttpContext,
  ): Observable<Orden> {
    return this.http.put<Orden>(
      `${API}/${orden.id}/servicios/${itemId}`,
      { version: orden.version, ...datos },
      { context },
    );
  }

  quitarServicio(orden: Orden, itemId: number): Observable<Orden> {
    return this.http.delete<Orden>(`${API}/${orden.id}/servicios/${itemId}`, {
      params: new HttpParams().set('version', orden.version),
    });
  }

  agregarRepuesto(
    orden: Orden,
    productoId: number,
    cantidad: number,
    context?: HttpContext,
  ): Observable<Orden> {
    return this.http.post<Orden>(
      `${API}/${orden.id}/repuestos`,
      { version: orden.version, productoId, cantidad },
      { context },
    );
  }

  cambiarCantidadRepuesto(
    orden: Orden,
    itemId: number,
    cantidad: number,
    context?: HttpContext,
  ): Observable<Orden> {
    return this.http.put<Orden>(
      `${API}/${orden.id}/repuestos/${itemId}`,
      { version: orden.version, cantidad },
      { context },
    );
  }

  quitarRepuesto(orden: Orden, itemId: number): Observable<Orden> {
    return this.http.delete<Orden>(`${API}/${orden.id}/repuestos/${itemId}`, {
      params: new HttpParams().set('version', orden.version),
    });
  }

  presupuestos(ordenId: number, context?: HttpContext): Observable<Presupuesto[]> {
    return this.http.get<Presupuesto[]>(`${API}/${ordenId}/presupuestos`, { context });
  }

  generarPresupuesto(
    orden: Orden,
    descuento: number,
    observaciones: string | null,
    context?: HttpContext,
  ): Observable<Presupuesto> {
    return this.http.post<Presupuesto>(
      `${API}/${orden.id}/presupuestos`,
      { version: orden.version, descuento, observaciones },
      { context },
    );
  }

  decidirPresupuesto(
    id: number,
    decision: 'APROBADO' | 'RECHAZADO',
    observaciones: string | null,
  ): Observable<Presupuesto> {
    return this.http.post<Presupuesto>(`/api/v1/presupuestos/${id}/decision`, {
      decision,
      observaciones,
    });
  }

  retirarPresupuesto(id: number): Observable<Presupuesto> {
    return this.http.post<Presupuesto>(`/api/v1/presupuestos/${id}/retiro`, {});
  }

  documentoPresupuesto(id: number, context?: HttpContext): Observable<DocumentoPresupuesto> {
    return this.http.get<DocumentoPresupuesto>(`/api/v1/presupuestos/${id}`, { context });
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

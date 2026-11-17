import { HttpClient, HttpContext } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

const API = '/api/v1/configuracion';

/** Configuración editable del taller (`CONFIGURACION_GESTIONAR`). El NIT llega con su DV. */
export interface ConfiguracionTaller {
  nombre: string;
  nit: string;
  direccion: string;
  telefono: string;
  email: string | null;
  ivaPorcentaje: number;
  textoAutorizacionDatos: string;
  alertaStockHabilitada: boolean;
}

/** Parámetros del taller: IVA y texto de autorización para todos; la edición, solo admin. */
@Injectable({ providedIn: 'root' })
export class ConfiguracionApiService {
  private readonly http = inject(HttpClient);

  /** IVA vigente (RN-03) para mostrar totales antes de guardar; el backend recalcula al registrar. */
  iva(context?: HttpContext): Observable<{ porcentaje: number }> {
    return this.http.get<{ porcentaje: number }>(`${API}/iva`, { context });
  }

  obtener(context?: HttpContext): Observable<ConfiguracionTaller> {
    return this.http.get<ConfiguracionTaller>(API, { context });
  }

  /** Guarda todo y queda en la auditoría (RN-51). */
  actualizar(datos: ConfiguracionTaller, context?: HttpContext): Observable<ConfiguracionTaller> {
    return this.http.put<ConfiguracionTaller>(API, datos, { context });
  }
}

import { HttpClient, HttpContext } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

/** Parámetros de configuración que leen otros módulos (la edición llega en F11). */
@Injectable({ providedIn: 'root' })
export class ConfiguracionApiService {
  private readonly http = inject(HttpClient);

  /** IVA vigente (RN-03) para mostrar totales antes de guardar; el backend recalcula al registrar. */
  iva(context?: HttpContext): Observable<{ porcentaje: number }> {
    return this.http.get<{ porcentaje: number }>('/api/v1/configuracion/iva', { context });
  }
}

import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export interface PingResponse {
  mensaje: string;
  fecha: string;
}

/** Servicio temporal para probar la conexión con el backend. Se elimina en F02. */
@Injectable({ providedIn: 'root' })
export class PingApiService {
  private readonly http = inject(HttpClient);

  ping(): Observable<PingResponse> {
    return this.http.get<PingResponse>('/api/v1/ping');
  }
}

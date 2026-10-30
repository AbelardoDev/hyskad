import { HttpClient, HttpContext } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { Idioma } from '../i18n/language.service';
import { SesionResponse, UsuarioSesion } from './auth.models';

export const API_AUTH = '/api/v1/auth';

/** Endpoints de `/auth` (RF2, RF35, IC3). El estado de la sesión vive en `AuthService`. */
@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly http = inject(HttpClient);

  login(email: string, password: string, context?: HttpContext): Observable<SesionResponse> {
    return this.http.post<SesionResponse>(`${API_AUTH}/login`, { email, password }, { context });
  }

  refrescar(context?: HttpContext): Observable<SesionResponse> {
    return this.http.post<SesionResponse>(`${API_AUTH}/refresh`, null, { context });
  }

  logout(context?: HttpContext): Observable<void> {
    return this.http.post<void>(`${API_AUTH}/logout`, null, { context });
  }

  me(): Observable<UsuarioSesion> {
    return this.http.get<UsuarioSesion>(`${API_AUTH}/me`);
  }

  cambiarIdioma(idioma: Idioma, context?: HttpContext): Observable<UsuarioSesion> {
    return this.http.put<UsuarioSesion>(`${API_AUTH}/me/preferencias`, { idioma }, { context });
  }

  cambiarPassword(actual: string, nueva: string, context?: HttpContext): Observable<void> {
    return this.http.post<void>(`${API_AUTH}/password/cambiar`, { actual, nueva }, { context });
  }

  solicitarRecuperacion(email: string, context?: HttpContext): Observable<void> {
    return this.http.post<void>(`${API_AUTH}/password/olvide`, { email }, { context });
  }

  restablecerPassword(token: string, nueva: string, context?: HttpContext): Observable<void> {
    return this.http.post<void>(`${API_AUTH}/password/restablecer`, { token, nueva }, { context });
  }
}

import { HttpContext } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  catchError,
  finalize,
  firstValueFrom,
  map,
  Observable,
  of,
  shareReplay,
  throwError,
} from 'rxjs';

import { Idioma, LanguageService } from '../i18n/language.service';
import { erroresManejados } from '../http/contexto-http';
import { AuthApiService } from './auth-api.service';
import { SesionResponse, UsuarioSesion } from './auth.models';
import { Permiso } from './permisos';

/** Segundos antes del vencimiento del access token en que se renueva solo. */
export const ANTICIPACION_REFRESCO_S = 60;
const REFRESCO_MINIMO_S = 5;

interface Sesion {
  usuario: UsuarioSesion;
  token: string;
}

/** Solo rutas internas de la app (evita redirecciones abiertas con `returnUrl`). */
export function esRutaInterna(url: string | null | undefined): url is string {
  return !!url && url.startsWith('/') && !url.startsWith('//') && !url.startsWith('/\\');
}

/**
 * Sesión del usuario (RF2, IC3). El access token vive **solo en memoria**; al recargar la página
 * se recupera con `POST /auth/refresh` (la cookie `HttpOnly` viaja sola) y se renueva un minuto
 * antes de vencer. Los permisos efectivos vienen del backend.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(AuthApiService);
  private readonly router = inject(Router);
  private readonly idioma = inject(LanguageService);

  private readonly sesion = signal<Sesion | null>(null);
  private refrescoEnCurso: Observable<string> | null = null;
  private temporizador: ReturnType<typeof setTimeout> | undefined;

  readonly usuario = computed(() => this.sesion()?.usuario ?? null);
  readonly permisos = computed<ReadonlySet<string>>(() => new Set(this.usuario()?.permisos));
  readonly estaAutenticado = computed(() => this.sesion() !== null);

  token(): string | null {
    return this.sesion()?.token ?? null;
  }

  tienePermiso(permiso: Permiso): boolean {
    return this.permisos().has(permiso);
  }

  /** `true` si tiene al menos uno de los permisos (o si la lista está vacía). */
  tieneAlguno(permisos: readonly Permiso[]): boolean {
    return permisos.length === 0 || permisos.some((p) => this.permisos().has(p));
  }

  /** Al arrancar la app: recupera la sesión si hay cookie de refresh válida. Nunca falla. */
  async restaurar(): Promise<void> {
    await firstValueFrom(this.refrescar().pipe(catchError(() => of(null))));
  }

  login(email: string, password: string, context?: HttpContext): Observable<UsuarioSesion> {
    return this.api.login(email, password, context).pipe(map((r) => this.abrir(r)));
  }

  /**
   * Renueva el access token. Si ya hay un refresh en curso, devuelve ese mismo: todas las
   * peticiones que recibieron 401 a la vez esperan una única llamada (la cookie rota en cada uso
   * y presentarla dos veces revocaría la sesión, CP-05). Si falla, cierra la sesión local.
   */
  refrescar(): Observable<string> {
    this.refrescoEnCurso ??= this.api.refrescar(erroresManejados()).pipe(
      map((r) => {
        this.abrir(r);
        return r.accessToken;
      }),
      catchError((error: unknown) => {
        this.cerrarLocal();
        return throwError(() => error);
      }),
      finalize(() => (this.refrescoEnCurso = null)),
      shareReplay(1),
    );
    return this.refrescoEnCurso;
  }

  /** La sesión venció sin poder renovarse: va al login recordando dónde estaba. */
  sesionExpirada(): void {
    const retorno = this.router.url;
    this.cerrarLocal();
    void this.router.navigate(['/login'], {
      queryParams: esRutaInterna(retorno) && retorno !== '/' ? { returnUrl: retorno } : {},
    });
  }

  /** Revoca el refresh token en el backend (aunque falle, la sesión local se cierra). */
  async logout(): Promise<void> {
    await firstValueFrom(this.api.logout(erroresManejados()).pipe(catchError(() => of(undefined))));
    this.cerrarLocal();
    await this.router.navigateByUrl('/login');
  }

  /** Cambia el idioma de la interfaz y, con sesión iniciada, lo guarda como preferencia. */
  cambiarIdioma(idioma: Idioma): void {
    this.idioma.cambiar(idioma);
    if (this.usuario() && this.usuario()?.idioma !== idioma)
      this.api.cambiarIdioma(idioma).subscribe((u) => this.actualizarUsuario(u));
  }

  /** Datos nuevos del usuario (preferencias, contraseña cambiada) sin tocar el token. */
  actualizarUsuario(usuario: UsuarioSesion): void {
    this.sesion.update((s) => (s ? { ...s, usuario } : s));
  }

  private abrir(respuesta: SesionResponse): UsuarioSesion {
    this.sesion.set({ usuario: respuesta.usuario, token: respuesta.accessToken });
    if (this.idioma.idioma() !== respuesta.usuario.idioma)
      this.idioma.cambiar(respuesta.usuario.idioma);
    this.programarRefresco(respuesta.expiresIn);
    return respuesta.usuario;
  }

  private programarRefresco(vigenciaS: number): void {
    clearTimeout(this.temporizador);
    const esperaS = Math.max(vigenciaS - ANTICIPACION_REFRESCO_S, REFRESCO_MINIMO_S);
    this.temporizador = setTimeout(
      () => this.refrescar().subscribe({ error: () => this.sesionExpirada() }),
      esperaS * 1000,
    );
  }

  private cerrarLocal(): void {
    clearTimeout(this.temporizador);
    this.temporizador = undefined;
    this.sesion.set(null);
  }
}

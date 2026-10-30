import {
  HttpContextToken,
  HttpErrorResponse,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';

import { API_AUTH } from './auth-api.service';
import { AuthService } from './auth.service';

/** Endpoints de `/auth` que no llevan access token ni se reintentan tras un 401. */
const AUTH_PUBLICAS = [
  '/login',
  '/refresh',
  '/logout',
  '/password/olvide',
  '/password/restablecer',
].map((ruta) => `${API_AUTH}${ruta}`);

/** La petición ya se reintentó con un token nuevo: un segundo 401 no vuelve a refrescar. */
const REINTENTADA = new HttpContextToken<boolean>(() => false);

function conToken(req: HttpRequest<unknown>, token: string | null): HttpRequest<unknown> {
  return token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
}

/**
 * Agrega `Authorization: Bearer` a la API, `withCredentials` en `/auth/*` (cookie de refresh) y,
 * ante un 401, renueva el token **una sola vez** para todas las peticiones en vuelo y las reintenta
 * (CP-04). Si el refresh falla, cierra la sesión y lleva al login con la URL de retorno.
 */
export const authInterceptor: HttpInterceptorFn = (req, next: HttpHandlerFn) => {
  if (!req.url.startsWith('/api/')) return next(req);

  const auth = inject(AuthService);
  const base = req.url.startsWith(`${API_AUTH}/`) ? req.clone({ withCredentials: true }) : req;
  if (AUTH_PUBLICAS.includes(base.url)) return next(base);

  const token = auth.token();
  return next(conToken(base, token)).pipe(
    catchError((error: unknown) => {
      const renovable =
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        token !== null &&
        !base.context.get(REINTENTADA);
      if (!renovable) return throwError(() => error);

      return auth.refrescar().pipe(
        catchError(() => {
          auth.sesionExpirada();
          return throwError(() => error);
        }),
        switchMap((nuevo) => {
          base.context.set(REINTENTADA, true);
          return next(conToken(base, nuevo));
        }),
      );
    }),
  );
};

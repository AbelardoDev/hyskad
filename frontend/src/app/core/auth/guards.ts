import { inject } from '@angular/core';
import { CanActivateFn, CanMatchFn, Router, UrlSegment, UrlTree } from '@angular/router';

import { AuthService, esRutaInterna } from './auth.service';
import { Permiso } from './permisos';

export const RUTA_LOGIN = '/login';
export const RUTA_CAMBIAR_PASSWORD = '/cambiar-password';
export const RUTA_ACCESO_DENEGADO = '/acceso-denegado';

function alLogin(router: Router, retorno: string): UrlTree {
  return router.createUrlTree([RUTA_LOGIN], {
    queryParams: esRutaInterna(retorno) && retorno !== '/' ? { returnUrl: retorno } : {},
  });
}

/**
 * Exige sesión iniciada; sin ella va al login con la URL de retorno. Si el usuario debe cambiar
 * la contraseña (RN-46), solo lo deja ir a esa pantalla. Sirve como `canActivate` y
 * `canActivateChild`.
 */
export const authGuard: CanActivateFn = (_ruta, estado) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.estaAutenticado()) return alLogin(router, estado.url);
  if (auth.usuario()?.debeCambiarPassword) return router.parseUrl(RUTA_CAMBIAR_PASSWORD);
  return true;
};

/** Login, olvidé y restablecer: con sesión iniciada no tiene sentido entrar, va al inicio. */
export const invitadoGuard: CanActivateFn = () =>
  inject(AuthService).estaAutenticado() ? inject(Router).parseUrl('/') : true;

/** Solo con sesión iniciada (la pantalla de cambio obligatorio de contraseña). */
export const sesionGuard: CanActivateFn = (_ruta, estado) =>
  inject(AuthService).estaAutenticado() || alLogin(inject(Router), estado.url);

/**
 * `canMatch` de un módulo: basta con uno de los permisos. Sin sesión va al login (el `canMatch`
 * de los hijos se evalúa antes que el `canActivate` del shell); sin permiso, a la página 403.
 */
export function permisoGuard(...permisos: Permiso[]): CanMatchFn {
  return (_ruta, segmentos: UrlSegment[]) => {
    const auth = inject(AuthService);
    const router = inject(Router);
    if (!auth.estaAutenticado()) {
      const url =
        router.currentNavigation()?.initialUrl.toString() ??
        `/${segmentos.map((s) => s.path).join('/')}`;
      return alLogin(router, url);
    }
    return auth.tieneAlguno(permisos) || router.parseUrl(RUTA_ACCESO_DENEGADO);
  };
}

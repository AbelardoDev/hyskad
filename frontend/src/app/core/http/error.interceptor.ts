import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { catchError, throwError } from 'rxjs';

import { ToastService } from '../../shared/ui/toast/toast';
import { ERRORES_MANEJADOS, FORMULARIO, marcarErroresServidor, problemaDe } from './contexto-http';

/** Código del error para traducirlo con `errors.<CODE>`. */
export function codigoDeError(error: HttpErrorResponse): string {
  if (error.status === 0) return 'SIN_CONEXION';
  return problemaDe(error.error)?.code ?? 'DESCONOCIDO';
}

/**
 * Errores de la API → toast traducido por el `code` del `ProblemDetail` (ARCHITECTURE §8). Si la
 * petición trae un `FORMULARIO`, marca en él los `errors[]` de validación. No interviene cuando el
 * componente lo maneja (`ERRORES_MANEJADOS`) ni en los 401 (de eso se encarga `authInterceptor`).
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(ToastService);
  const transloco = inject(TranslocoService);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        error.status !== 401 &&
        !req.context.get(ERRORES_MANEJADOS)
      ) {
        const formulario = req.context.get(FORMULARIO);
        const errores = problemaDe(error.error)?.errors ?? [];
        if (formulario && errores.length > 0) marcarErroresServidor(formulario, errores);

        const clave = `errors.${codigoDeError(error)}`;
        const texto = transloco.translate(clave);
        toast.error(texto === clave ? transloco.translate('errors.DESCONOCIDO') : texto);
      }
      return throwError(() => error);
    }),
  );
};

import { HttpContext, HttpContextToken } from '@angular/common/http';
import { AbstractControl, FormGroup } from '@angular/forms';

/** El componente muestra él mismo el error: el interceptor no abre un toast. */
export const ERRORES_MANEJADOS = new HttpContextToken<boolean>(() => false);

/** Formulario en el que se marcan los `errors[]` de validación que devuelva el backend. */
export const FORMULARIO = new HttpContextToken<FormGroup | null>(() => null);

/** Contexto para una petición cuyo error maneja el componente. */
export function erroresManejados(): HttpContext {
  return new HttpContext().set(ERRORES_MANEJADOS, true);
}

/** Contexto para una petición que envía `formulario`: sus errores de campo se marcan en él. */
export function conFormulario(formulario: FormGroup): HttpContext {
  return new HttpContext().set(FORMULARIO, formulario);
}

/** Error de un campo en el `ProblemDetail` de validación. */
export interface ErrorCampoApi {
  campo: string;
  code: string;
}

/** `ProblemDetail` (RFC 9457) del backend con su `code` estable. */
export interface ProblemaApi {
  code?: string;
  status?: number;
  errors?: ErrorCampoApi[];
}

/** El cuerpo de un error HTTP si es un `ProblemDetail` del backend. */
export function problemaDe(error: unknown): ProblemaApi | null {
  return error !== null && typeof error === 'object' ? (error as ProblemaApi) : null;
}

/**
 * El control por su ruta (`telefono`, `clave.nueva`, `items[1].productoId` → `items.1.productoId`)
 * o, si no está, por su nombre en un subgrupo.
 */
function buscarControl(grupo: FormGroup, campo: string): AbstractControl | null {
  const directo = grupo.get(campo.replace(/\[(\d+)\]/g, '.$1'));
  if (directo) return directo;
  for (const hijo of Object.values(grupo.controls)) {
    const encontrado = hijo instanceof FormGroup ? buscarControl(hijo, campo) : null;
    if (encontrado) return encontrado;
  }
  return null;
}

/**
 * Marca en `formulario` los errores de campo del backend como `{ servidor: CODE }` (los traduce
 * `hk-form-field` a `errors.CODE`). Devuelve cuántos campos marcó.
 */
export function marcarErroresServidor(
  formulario: FormGroup,
  errores: readonly ErrorCampoApi[],
): number {
  let marcados = 0;
  for (const { campo, code } of errores) {
    const control = buscarControl(formulario, campo);
    if (!control) continue;
    control.setErrors({ servidor: code });
    control.markAsTouched();
    marcados++;
  }
  return marcados;
}

import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** Política de contraseñas del backend (`@PasswordSegura`). */
export const PASSWORD_LONGITUD_MINIMA = 8;
/** Límite de BCrypt en bytes UTF-8. */
export const PASSWORD_BYTES_MAXIMOS = 72;

/** Teléfono: dígitos y espacios, 7 a 20, con `+` opcional (igual que `DatosUsuario.TELEFONO`). */
export const PATRON_TELEFONO = /^\+?[0-9 ]{7,20}$/;

export interface ReglasPassword {
  longitud: boolean;
  letras: boolean;
  numeros: boolean;
  /** No supera los 72 bytes de BCrypt. */
  tamano: boolean;
}

export function reglasPassword(valor: string): ReglasPassword {
  return {
    longitud: valor.length >= PASSWORD_LONGITUD_MINIMA,
    letras: /\p{L}/u.test(valor),
    numeros: /\p{Nd}/u.test(valor),
    tamano: new TextEncoder().encode(valor).length <= PASSWORD_BYTES_MAXIMOS,
  };
}

export function cumplePolitica(valor: string): boolean {
  return Object.values(reglasPassword(valor)).every(Boolean);
}

/**
 * Fortaleza para el medidor: 0 vacía, 1 débil (no cumple la política), 2 aceptable (la cumple),
 * 3 fuerte (la cumple con 12 o más caracteres y mezcla mayúsculas, minúsculas o símbolos).
 */
export function fortalezaPassword(valor: string): 0 | 1 | 2 | 3 {
  if (!valor) return 0;
  if (!cumplePolitica(valor)) return 1;
  const variedad =
    (/\p{Lu}/u.test(valor) && /\p{Ll}/u.test(valor) ? 1 : 0) +
    (/[^\p{L}\p{Nd}]/u.test(valor) ? 1 : 0);
  return valor.length >= 12 && variedad > 0 ? 3 : 2;
}

/** Contraseña que cumple la política: `{ passwordDebil: true }` si no (vacía la deja a `required`). */
export const passwordSegura: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const valor: unknown = control.value;
  if (typeof valor !== 'string' || valor === '') return null;
  return cumplePolitica(valor) ? null : { passwordDebil: true };
};

/**
 * El valor debe ser igual al de otro control (confirmar contraseña): `{ noCoincide: true }`.
 * Quien lo usa debe revalidar este control cuando cambie el otro.
 */
export function igualA(otro: () => AbstractControl | null | undefined): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const referencia = otro();
    if (!control.value || !referencia) return null;
    return control.value === referencia.value ? null : { noCoincide: true };
  };
}

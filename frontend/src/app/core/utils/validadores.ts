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

// ── Documentos, placas y teléfonos (espejo de `shared.validation` del backend) ──────────────

export const TIPOS_DOCUMENTO = ['CC', 'TI', 'CE', 'PA', 'PPT', 'NIT'] as const;
export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number];

/** RN-38. El NIT son 9 dígitos + DV. Igual que `DocumentoValidoValidator.FORMATOS`. */
const FORMATOS_DOCUMENTO: Record<TipoDocumento, RegExp> = {
  CC: /^\d{5,10}$/,
  TI: /^\d{10,11}$/,
  CE: /^[A-Z0-9]{3,12}$/,
  PA: /^[A-Z0-9]{5,15}$/,
  PPT: /^\d{6,10}$/,
  NIT: /^\d{10}$/,
};

const PESOS_NIT = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];

/** Documento en mayúsculas sin espacios, puntos ni guiones: `900.123.456-8` → `9001234568`. */
export function normalizarDocumento(numero: string): string {
  return numero.replace(/[\s.-]/g, '').toUpperCase();
}

/**
 * Dígito de verificación DIAN (RN-39): módulo 11 con pesos primos de derecha a izquierda; si el
 * residuo es 0 o 1 el DV es el residuo, si no, 11 − residuo. `null` si no son de 1 a 15 dígitos.
 */
export function digitoVerificacionNit(nit: string): number | null {
  if (!/^\d{1,15}$/.test(nit)) return null;
  const suma = [...nit].reverse().reduce((total, d, i) => total + Number(d) * PESOS_NIT[i], 0);
  const residuo = suma % 11;
  return residuo < 2 ? residuo : 11 - residuo;
}

export function documentoValido(tipo: TipoDocumento, numero: string): boolean {
  const normalizado = normalizarDocumento(numero);
  if (!FORMATOS_DOCUMENTO[tipo].test(normalizado)) return false;
  if (tipo !== 'NIT') return true;
  return digitoVerificacionNit(normalizado.slice(0, 9)) === Number(normalizado[9]);
}

/** Como se guarda y se muestra: el NIT con guion antes del DV (`900123456-8`). */
export function documentoParaMostrar(tipo: TipoDocumento, numero: string): string {
  const normalizado = normalizarDocumento(numero);
  return tipo === 'NIT' && normalizado.length > 1
    ? `${normalizado.slice(0, -1)}-${normalizado.slice(-1)}`
    : normalizado;
}

/** Dígitos del NIT sin el dígito de verificación (RN-39). */
export const DIGITOS_NIT = 9;

/**
 * Número completo para enviar: a un NIT de 9 dígitos se le agrega el DV calculado; si ya trae los
 * 10, se deja tal cual para que la validación compruebe el DV escrito.
 */
export function numeroConDv(tipo: TipoDocumento | '' | null, numero: string): string {
  const normalizado = normalizarDocumento(numero);
  if (tipo !== 'NIT' || normalizado.length !== DIGITOS_NIT) return normalizado;
  return `${normalizado}${digitoVerificacionNit(normalizado) ?? ''}`;
}

/**
 * Número de documento válido para el tipo que dé `tipo()`: `{ nitInvalido: true }` o
 * `{ documentoInvalido: true }` (los mismos códigos del backend). Un NIT de 9 dígitos es válido
 * porque el DV se calcula. Revalidar al cambiar el tipo.
 */
export function documentoSegunTipo(tipo: () => TipoDocumento | '' | null | undefined): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const valor: unknown = control.value;
    const actual = tipo();
    if (typeof valor !== 'string' || valor.trim() === '' || !actual) return null;
    if (documentoValido(actual, numeroConDv(actual, valor))) return null;
    return actual === 'NIT' ? { nitInvalido: true } : { documentoInvalido: true };
  };
}

/**
 * RN-41: formatos de placa, espejo de `PlacaColombianaValidator`. Si el taller pide otro formato,
 * se cambia aquí y allá.
 */
export const FORMATOS_PLACA = [
  /^[A-Z]{3}[0-9]{2}[A-Z]$/, // moto actual: ABC12D
  /^[A-Z]{3}[0-9]{2}$/, // moto antigua: ABC12
  /^[0-9]{3}[A-Z]{3}$/, // motocarro: 123ABC
] as const;

/** Placa en mayúsculas, sin espacios ni guiones: `abc-12 d` → `ABC12D`. */
export function normalizarPlaca(placa: string): string {
  return placa.replace(/[\s-]/g, '').toUpperCase();
}

export function placaValida(placa: string): boolean {
  const normalizada = normalizarPlaca(placa);
  return FORMATOS_PLACA.some((formato) => formato.test(normalizada));
}

/** `{ placaInvalida: true }` si no cumple ningún formato (vacía la deja a `required`). */
export const placaColombiana: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const valor: unknown = control.value;
  if (typeof valor !== 'string' || valor.trim() === '') return null;
  return placaValida(valor) ? null : { placaInvalida: true };
};

/** Teléfono solo con dígitos, sin el indicativo `+57`: `+57 300 123-4567` → `3001234567`. */
export function normalizarTelefono(telefono: string): string {
  const digitos = telefono.replace(/[\s().-]/g, '');
  return digitos.startsWith('+57') ? digitos.slice(3) : digitos;
}

/** Celular (`3…`) o fijo con indicativo (`60…`) de 10 dígitos, como `@TelefonoColombiano`. */
export const telefonoColombiano: ValidatorFn = (
  control: AbstractControl,
): ValidationErrors | null => {
  const valor: unknown = control.value;
  if (typeof valor !== 'string' || valor.trim() === '') return null;
  return /^(3\d{9}|60\d{8})$/.test(normalizarTelefono(valor)) ? null : { telefonoInvalido: true };
};

/** RN-42: 17 caracteres alfanuméricos sin I, O ni Q: `{ vinInvalido: true }`. */
export const vinValido: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const valor: unknown = control.value;
  if (typeof valor !== 'string' || valor.trim() === '') return null;
  return /^[A-HJ-NPR-Z0-9]{17}$/i.test(valor.trim()) ? null : { vinInvalido: true };
};

// ── Cantidades de inventario (DECIMAL(12,2) en el backend) ─────────────────────────────────────

const PATRON_CANTIDAD = /^\d{1,10}([.,]\d{1,2})?$/;

/** Texto escrito por el usuario (`12,5` o `12.5`) a número; `null` si no es una cantidad válida. */
export function aCantidad(texto: string): number | null {
  const limpio = texto.trim();
  return PATRON_CANTIDAD.test(limpio) ? Number(limpio.replace(',', '.')) : null;
}

/**
 * Cantidad con máximo 2 decimales: `{ cantidadInvalida: true }` si no lo es, y
 * `{ cantidadPositiva: true }` si con `positiva` vale 0. Vacía la deja a `required`.
 */
export function cantidad(opciones: { positiva: boolean }): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const valor: unknown = control.value;
    if (typeof valor !== 'string' || valor.trim() === '') return null;
    const numero = aCantidad(valor);
    if (numero === null) return { cantidadInvalida: true };
    return opciones.positiva && numero === 0 ? { cantidadPositiva: true } : null;
  };
}

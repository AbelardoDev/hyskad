/** Formateadores de moneda y fecha con la locale activa (es-CO / en-US). */

const formatosCop = new Map<string, Intl.NumberFormat>();
const formatosRelativos = new Map<string, Intl.RelativeTimeFormat>();
const formatosFecha = new Map<string, Intl.DateTimeFormat>();

export type Monto = number | string | null | undefined;

/** Convierte un monto (los BigDecimal llegan como número o texto) a número; `null` si no es válido. */
export function aNumero(valor: Monto): number | null {
  if (valor === null || valor === undefined || valor === '') return null;
  const numero = typeof valor === 'number' ? valor : Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

/**
 * Pesos colombianos sin decimales (CLAUDE.md: redondeo HALF_UP a 0 decimales).
 * `Intl` redondea con `halfExpand`, que coincide con HALF_UP.
 */
export function formatoCop(valor: Monto, locale: string): string {
  const numero = aNumero(valor);
  if (numero === null) return '';
  let formato = formatosCop.get(locale);
  if (!formato) {
    formato = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'COP',
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
    formatosCop.set(locale, formato);
  }
  return formato.format(numero);
}

/** Número entero con separador de miles, sin símbolo (lo usa hk-money-input al escribir). */
export function formatoMiles(valor: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(valor);
}

const formatosCantidad = new Map<string, Intl.NumberFormat>();

/** Cantidad de inventario: miles con separador y hasta 2 decimales ("1.250", "12,5"). */
export function formatoCantidad(valor: Monto, locale: string): string {
  const numero = aNumero(valor);
  if (numero === null) return '';
  let formato = formatosCantidad.get(locale);
  if (!formato) {
    formato = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
    formatosCantidad.set(locale, formato);
  }
  return formato.format(numero);
}

const UNIDADES: readonly [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

/** "hace 5 min", "en 2 h", "ahora" (en: "5 min. ago", "now"). */
export function tiempoRelativo(
  fecha: Date | string | number,
  locale: string,
  ahora = Date.now(),
): string {
  const instante = fecha instanceof Date ? fecha.getTime() : new Date(fecha).getTime();
  if (Number.isNaN(instante)) return '';
  let formato = formatosRelativos.get(locale);
  if (!formato) {
    formato = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' });
    formatosRelativos.set(locale, formato);
  }
  const segundos = Math.round((instante - ahora) / 1000);
  for (const [unidad, duracion] of UNIDADES) {
    if (Math.abs(segundos) >= duracion)
      return formato.format(Math.trunc(segundos / duracion), unidad);
  }
  return formato.format(0, 'second');
}

export type EstiloFecha = 'corta' | 'media' | 'fechaHora';

const OPCIONES_FECHA: Record<EstiloFecha, Intl.DateTimeFormatOptions> = {
  corta: { dateStyle: 'short' },
  media: { dateStyle: 'medium' },
  fechaHora: { dateStyle: 'medium', timeStyle: 'short' },
};

/**
 * Una fecha sin hora (`2026-10-30`, como la de una factura) es un día del calendario, no un
 * instante: `new Date('2026-10-30')` sería medianoche UTC y en Colombia mostraría el día anterior.
 */
function aFecha(fecha: Date | string | number): Date {
  if (fecha instanceof Date) return fecha;
  const soloFecha = typeof fecha === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha) : null;
  if (soloFecha)
    return new Date(Number(soloFecha[1]), Number(soloFecha[2]) - 1, Number(soloFecha[3]));
  return new Date(fecha);
}

export function formatoFecha(
  fecha: Date | string | number,
  locale: string,
  estilo: EstiloFecha = 'media',
): string {
  const valor = aFecha(fecha);
  if (Number.isNaN(valor.getTime())) return '';
  const clave = `${locale}|${estilo}`;
  let formato = formatosFecha.get(clave);
  if (!formato) {
    formato = new Intl.DateTimeFormat(locale, OPCIONES_FECHA[estilo]);
    formatosFecha.set(clave, formato);
  }
  return formato.format(valor);
}

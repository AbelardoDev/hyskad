/**
 * Espejo de `CalculadoraTotales` (RN-04) para mostrar totales antes de guardar; el backend vuelve
 * a calcularlos al registrar. Los subtotales de línea van con centavos y el impuesto se redondea a
 * pesos enteros (HALF_UP).
 */
export interface Totales {
  subtotal: number;
  descuento: number;
  impuesto: number;
  total: number;
}

/** `Math.round` redondea las mitades hacia arriba, igual que HALF_UP con montos positivos. */
const centavos = (valor: number) => Math.round(valor * 100) / 100;

export function subtotalLinea(cantidad: number, precioUnitario: number): number {
  return centavos(cantidad * precioUnitario);
}

export function calcularTotales(
  lineas: readonly { cantidad: number; precioUnitario: number }[],
  descuento: number,
  ivaPorcentaje: number,
): Totales {
  const subtotal = centavos(
    lineas.reduce((suma, l) => suma + subtotalLinea(l.cantidad, l.precioUnitario), 0),
  );
  const base = centavos(subtotal - descuento);
  const impuesto = Math.round((base * ivaPorcentaje) / 100);
  return { subtotal, descuento, impuesto, total: centavos(base + impuesto) };
}

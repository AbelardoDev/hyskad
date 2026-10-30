import { calcularTotales, subtotalLinea } from './dinero';

/**
 * Los mismos casos fijos de `CalculadoraTotalesTest.casosFijosCompartidosConElFrontend` del
 * backend: el total que ve el vendedor antes de cobrar debe ser idéntico al que se guarda.
 */
describe('calcularTotales: casos fijos compartidos con el backend (RN-04, RN-05)', () => {
  const casos: [string, number, number, number, number, number][] = [
    ['1×10000', 0, 19, 10000, 1900, 11900],
    ['2×12345;1×50000', 74690, 19, 74690, 0, 0],
    ['3×1000', 0, 0, 3000, 0, 3000],
    ['1×1250', 0, 19, 1250, 238, 1488],
    ['1×3950', 0, 19, 3950, 751, 4701],
    ['2.5×17500.33', 0, 19, 43750.83, 8313, 52063.83],
    ['1×10000', 2500, 19, 10000, 1425, 8925],
    ['3×333.33', 0, 19, 999.99, 190, 1189.99],
  ];

  it.each(casos)(
    '%s − %d con IVA %d %% → %d + %d = %d',
    (lineas, descuento, iva, subtotal, impuesto, total) => {
      const items = lineas.split(';').map((l) => {
        const [cantidad, precio] = l.split('×').map(Number);
        return { cantidad, precioUnitario: precio };
      });
      expect(calcularTotales(items, descuento, iva)).toEqual({
        subtotal,
        descuento,
        impuesto,
        total,
      });
    },
  );

  it('el subtotal de línea conserva centavos', () => {
    expect(subtotalLinea(3, 333.33)).toBe(999.99);
    expect(subtotalLinea(0.1, 0.2)).toBe(0.02);
  });
});

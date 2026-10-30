package com.hyskad.shared.dinero;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Collection;

/**
 * Fórmula común de totales (RN-04) para compras, ventas, presupuestos y órdenes. Clase pura, sin
 * Spring: {@code subtotal = Σ(cantidad × precio)} · {@code base = subtotal − descuento} ·
 * {@code impuesto = round(base × iva% / 100)} a pesos enteros · {@code total = base + impuesto}.
 * Redondeo {@code HALF_UP}; los subtotales de línea se guardan con centavos.
 */
public final class CalculadoraTotales {

    private static final int CENTAVOS = 2;
    private static final BigDecimal CIEN = new BigDecimal("100");

    private CalculadoraTotales() {
    }

    /** Subtotal de una línea con centavos ({@code DECIMAL(15,2)}). */
    public static BigDecimal subtotalLinea(BigDecimal cantidad, BigDecimal precioUnitario) {
        return cantidad.multiply(precioUnitario).setScale(CENTAVOS, RoundingMode.HALF_UP);
    }

    /**
     * Totales de un documento. RN-05: el descuento va de 0 al subtotal; quien llama valida con su
     * propio error de negocio antes (aquí es un error de programación).
     */
    public static Totales calcular(Collection<BigDecimal> subtotalesLinea, BigDecimal descuento,
            BigDecimal ivaPorcentaje) {
        BigDecimal subtotal = subtotalesLinea.stream().reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(CENTAVOS, RoundingMode.HALF_UP);
        if (descuento.signum() < 0 || descuento.compareTo(subtotal) > 0) {
            throw new IllegalArgumentException("El descuento debe estar entre 0 y el subtotal");
        }
        BigDecimal base = subtotal.subtract(descuento);
        BigDecimal impuesto = base.multiply(ivaPorcentaje).divide(CIEN, 0, RoundingMode.HALF_UP)
                .setScale(CENTAVOS, RoundingMode.UNNECESSARY);
        return new Totales(subtotal, descuento.setScale(CENTAVOS, RoundingMode.HALF_UP), impuesto,
                base.add(impuesto).setScale(CENTAVOS, RoundingMode.HALF_UP));
    }

    public record Totales(BigDecimal subtotal, BigDecimal descuento, BigDecimal impuesto, BigDecimal total) {
    }
}

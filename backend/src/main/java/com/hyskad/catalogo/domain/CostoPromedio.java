package com.hyskad.catalogo.domain;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Costo promedio ponderado (RN-07):
 * {@code (stock × costo_promedio + cantidad × costo_entrada) / (stock + cantidad)}, redondeado
 * {@code HALF_UP} a centavos como se guarda ({@code DECIMAL(15,2)}). Clase pura, sin Spring.
 */
public final class CostoPromedio {

    private static final int ESCALA = 2;

    private CostoPromedio() {
    }

    public static BigDecimal calcular(BigDecimal stockActual, BigDecimal costoActual, BigDecimal cantidad,
            BigDecimal costoEntrada) {
        BigDecimal total = stockActual.add(cantidad);
        if (stockActual.signum() == 0 || total.signum() == 0) {
            return costoEntrada.setScale(ESCALA, RoundingMode.HALF_UP);
        }
        BigDecimal valor = stockActual.multiply(costoActual).add(cantidad.multiply(costoEntrada));
        return valor.divide(total, ESCALA, RoundingMode.HALF_UP);
    }
}

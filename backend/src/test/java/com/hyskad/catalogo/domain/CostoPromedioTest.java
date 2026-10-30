package com.hyskad.catalogo.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

/** RN-07: costo promedio ponderado (CP-23, fórmula). */
class CostoPromedioTest {

    private static BigDecimal d(String valor) {
        return new BigDecimal(valor);
    }

    @Test
    void cp23DiezUnidadesA12000SobreDiezA10000Dan11000() {
        assertThat(CostoPromedio.calcular(d("10"), d("10000"), d("10"), d("12000"))).isEqualByComparingTo("11000");
    }

    @Test
    void sinStockElCostoEsElDeLaEntradaAunqueElPromedioAnteriorSeaOtro() {
        assertThat(CostoPromedio.calcular(d("0"), d("8000"), d("5"), d("12000"))).isEqualTo(d("12000.00"));
    }

    @ParameterizedTest(name = "{0} u a {1} + {2} u a {3} = {4}")
    @CsvSource({
            // decimales en cantidades (litros, metros) y en costos
            "2.5, 17500.00, 1.5, 18000.00, 17687.50",
            // 10 000 / 3 = 3333,333… → 3333,33
            "2, 0, 1, 10000, 3333.33",
            // 20 000 / 3 = 6666,666… → 6666,67 (HALF_UP)
            "1, 10000, 2, 5000, 6666.67",
            // costo de entrada 0 (bonificación) baja el promedio
            "3, 9000, 1, 0, 6750.00",
            // la misma entrada al mismo costo no lo cambia
            "7, 4321.55, 3, 4321.55, 4321.55" })
    void promediaConDosDecimalesYRedondeoHalfUp(String stock, String costo, String cantidad, String costoEntrada,
            String esperado) {
        assertThat(CostoPromedio.calcular(d(stock), d(costo), d(cantidad), d(costoEntrada))).isEqualTo(d(esperado));
    }
}

package com.hyskad.shared.dinero;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.math.BigDecimal;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.hyskad.shared.dinero.CalculadoraTotales.Totales;

/** RN-04 y RN-05: fórmula común de totales con IVA y redondeo HALF_UP a pesos. */
class CalculadoraTotalesTest {

    private static BigDecimal d(String valor) {
        return new BigDecimal(valor);
    }

    @Test
    void cp29SubtotalMenosDescuentoMasIvaRedondeadoAPesos() {
        // 2 × 12.345 + 1 × 50.000 = 74.690; base 70.000; IVA 19 % = 13.300
        Totales t = CalculadoraTotales.calcular(List.of(CalculadoraTotales.subtotalLinea(d("2"), d("12345")),
                CalculadoraTotales.subtotalLinea(d("1"), d("50000"))), d("4690"), d("19"));

        assertThat(t.subtotal()).isEqualTo(d("74690.00"));
        assertThat(t.descuento()).isEqualTo(d("4690.00"));
        assertThat(t.impuesto()).isEqualTo(d("13300.00"));
        assertThat(t.total()).isEqualTo(d("83300.00"));
    }

    @Test
    void elImpuestoSeRedondeaHalfUpAPesosEnteros() {
        // 1.250 × 19 % = 237,5 → 238 ; 1.249 × 19 % = 237,31 → 237
        assertThat(CalculadoraTotales.calcular(List.of(d("1250")), BigDecimal.ZERO, d("19")).impuesto())
                .isEqualTo(d("238.00"));
        assertThat(CalculadoraTotales.calcular(List.of(d("1249")), BigDecimal.ZERO, d("19")).impuesto())
                .isEqualTo(d("237.00"));
    }

    @Test
    void lineasConCantidadesFraccionariasConservanCentavos() {
        assertThat(CalculadoraTotales.subtotalLinea(d("2.5"), d("17500.33"))).isEqualTo(d("43750.83"));
        Totales t = CalculadoraTotales.calcular(List.of(d("43750.83")), BigDecimal.ZERO, d("19"));
        assertThat(t.impuesto()).isEqualTo(d("8313.00"));
        assertThat(t.total()).isEqualTo(d("52063.83"));
    }

    @Test
    void sinLineasTodoEsCeroYSinIvaNoHayImpuesto() {
        assertThat(CalculadoraTotales.calcular(List.of(), BigDecimal.ZERO, d("19")).total()).isEqualTo(d("0.00"));
        assertThat(CalculadoraTotales.calcular(List.of(d("1000")), BigDecimal.ZERO, d("0")).total())
                .isEqualTo(d("1000.00"));
    }

    @Test
    void rn05ElDescuentoVaDeCeroAlSubtotal() {
        assertThatThrownBy(() -> CalculadoraTotales.calcular(List.of(d("1000")), d("-1"), d("19")))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> CalculadoraTotales.calcular(List.of(d("1000")), d("1000.01"), d("19")))
                .isInstanceOf(IllegalArgumentException.class);
        assertThat(CalculadoraTotales.calcular(List.of(d("1000")), d("1000"), d("19")).total()).isEqualTo(d("0.00"));
    }
}

package com.hyskad.shared.consecutivo;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class ConsecutivoServiceTest {

    @ParameterizedTest
    @CsvSource({ "OT, 1, OT-000001", "VENTA, 42, V-000042", "COMPRA, 999999, C-999999",
        "PRESUPUESTO, 1000000, P-1000000" })
    void formateaConPrefijoYSeisDigitos(TipoConsecutivo tipo, long numero, String esperado) {
        assertThat(ConsecutivoService.formatear(tipo, numero)).isEqualTo(esperado);
    }
}

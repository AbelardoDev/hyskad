package com.hyskad.shared.validation;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

class TelefonoColombianoValidatorTest {

    private final TelefonoColombianoValidator validator = new TelefonoColombianoValidator();

    @ParameterizedTest
    @ValueSource(strings = { "3001234567", "300 123 4567", "+57 300 123-4567", "(604) 789.1234", "6017654321" })
    void aceptaCelularesYFijosDeDiezDigitos(String telefono) {
        assertThat(validator.isValid(telefono, null)).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = { "300123456", "30012345678", "2001234567", "6101234567", "57 3001234567", "300ABC4567" })
    void rechazaOtrosFormatos(String telefono) {
        assertThat(validator.isValid(telefono, null)).isFalse();
    }

    @Test
    void nuloOVacioLoReportaNotBlank() {
        assertThat(validator.isValid(null, null)).isTrue();
        assertThat(validator.isValid("  ", null)).isTrue();
    }

    @ParameterizedTest
    @CsvSource({ "'+57 300 123-4567', 3001234567", "'(604) 789.1234', 6047891234" })
    void normalizaSoloADigitos(String entrada, String esperado) {
        assertThat(Normalizador.telefono(entrada)).isEqualTo(esperado);
    }

    @Test
    void normalizaElVin() {
        assertThat(Normalizador.vin(" 9c6ke1220m0012345 ")).isEqualTo("9C6KE1220M0012345");
        assertThat(Normalizador.vin(" ")).isNull();
        assertThat(Normalizador.vin(null)).isNull();
    }
}

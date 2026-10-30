package com.hyskad.shared.validation;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

/** CP-17 (parte backend): formatos de placa de RN-41. */
class PlacaColombianaValidatorTest {

    private final PlacaColombianaValidator validator = new PlacaColombianaValidator();

    @ParameterizedTest
    @ValueSource(strings = { "ABC12D", "abc-12d", "ABC12", "123ABC", " abc 12 d ", "123-abc" })
    void aceptaFormatosValidos(String placa) {
        assertThat(validator.isValid(placa, null)).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = { "AB123", "ABCD12", "ABC123", "12ABC", "ABC1D", "", "ÑBC12D", "ABC12DE" })
    void rechazaFormatosInvalidos(String placa) {
        assertThat(validator.isValid(placa, null)).isFalse();
    }

    @Test
    void nuloEsValidoParaCombinarConNotBlank() {
        assertThat(validator.isValid(null, null)).isTrue();
    }

    @ParameterizedTest
    @CsvSource({ "abc-12d, ABC12D", "' abc 12 ', ABC12", "123-abc, 123ABC" })
    void normalizaAMayusculasSinEspaciosNiGuiones(String entrada, String esperada) {
        assertThat(Normalizador.placa(entrada)).isEqualTo(esperada);
    }
}

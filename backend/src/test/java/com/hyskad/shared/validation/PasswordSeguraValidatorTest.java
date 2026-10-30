package com.hyskad.shared.validation;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

class PasswordSeguraValidatorTest {

    private final PasswordSeguraValidator validador = new PasswordSeguraValidator();

    @ParameterizedTest
    @ValueSource(strings = { "Clave123", "abcdefg1", "12345678a", "Contraseña2026", "con espacio 9", "ÑandúÑandú1" })
    void aceptaOchoOMasCaracteresConLetrasYNumeros(String password) {
        assertThat(PasswordSeguraValidator.esSegura(password)).isTrue();
        assertThat(validador.isValid(password, null)).isTrue();
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = { "Clave12", "abcdefgh", "12345678", "        ", "!!!!!!!!1" })
    void rechazaCortasOSinLetrasOSinNumeros(String password) {
        assertThat(PasswordSeguraValidator.esSegura(password)).isFalse();
    }

    @Test
    void rechazaLasQueSuperanElLimiteDeBcrypt() {
        assertThat(PasswordSeguraValidator.esSegura("a1".repeat(36))).isTrue();
        assertThat(PasswordSeguraValidator.esSegura("a1".repeat(36) + "x")).isFalse();
        assertThat(PasswordSeguraValidator.esSegura("ñ1".repeat(25))).as("ñ ocupa 2 bytes: 75 bytes").isFalse();
    }

    @Test
    void nullEsValidoParaBeanValidation() {
        assertThat(validador.isValid(null, null)).isTrue();
    }
}

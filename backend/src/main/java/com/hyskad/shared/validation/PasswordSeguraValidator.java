package com.hyskad.shared.validation;

import java.nio.charset.StandardCharsets;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

/** Valida {@link PasswordSegura}. La regla también se usa fuera de Bean Validation (admin inicial). */
public class PasswordSeguraValidator implements ConstraintValidator<PasswordSegura, String> {

    static final int LONGITUD_MINIMA = 8;
    /** Límite de BCrypt en bytes UTF-8. */
    static final int BYTES_MAXIMOS = 72;

    @Override
    public boolean isValid(String valor, ConstraintValidatorContext context) {
        return valor == null || esSegura(valor);
    }

    public static boolean esSegura(String password) {
        if (password == null || password.length() < LONGITUD_MINIMA
                || password.getBytes(StandardCharsets.UTF_8).length > BYTES_MAXIMOS) {
            return false;
        }
        boolean letra = password.chars().anyMatch(Character::isLetter);
        boolean digito = password.chars().anyMatch(Character::isDigit);
        return letra && digito;
    }
}

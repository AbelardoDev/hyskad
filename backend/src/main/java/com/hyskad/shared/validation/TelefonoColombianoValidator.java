package com.hyskad.shared.validation;

import java.util.regex.Pattern;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

/** Valida {@link TelefonoColombiano}; su espejo vive en el frontend. */
public class TelefonoColombianoValidator implements ConstraintValidator<TelefonoColombiano, String> {

    private static final Pattern FORMATO = Pattern.compile("^(3\\d{9}|60\\d{8})$");

    public static boolean esValido(String telefono) {
        String normalizado = Normalizador.telefono(telefono);
        return normalizado != null && FORMATO.matcher(normalizado).matches();
    }

    @Override
    public boolean isValid(String telefono, ConstraintValidatorContext context) {
        // El vacío lo reporta @NotBlank; así no salen dos errores en el mismo campo
        return telefono == null || telefono.isBlank() || esValido(telefono);
    }
}

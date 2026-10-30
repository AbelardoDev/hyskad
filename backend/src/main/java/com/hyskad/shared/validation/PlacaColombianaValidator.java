package com.hyskad.shared.validation;

import java.util.List;
import java.util.regex.Pattern;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

/**
 * Único lugar con los formatos de placa (RN-41); su espejo vive en el frontend. La placa se
 * normaliza (mayúsculas, sin espacios ni guiones) antes de comparar.
 */
public class PlacaColombianaValidator implements ConstraintValidator<PlacaColombiana, String> {

    private static final List<Pattern> FORMATOS = List.of(
            Pattern.compile("^[A-Z]{3}[0-9]{2}[A-Z]$"), // moto actual: ABC12D
            Pattern.compile("^[A-Z]{3}[0-9]{2}$"), // moto antigua: ABC12
            Pattern.compile("^[0-9]{3}[A-Z]{3}$")); // motocarro: 123ABC

    public static boolean esValida(String placa) {
        String normalizada = Normalizador.placa(placa);
        return normalizada != null && FORMATOS.stream().anyMatch(f -> f.matcher(normalizada).matches());
    }

    @Override
    public boolean isValid(String placa, ConstraintValidatorContext context) {
        return placa == null || esValida(placa);
    }
}

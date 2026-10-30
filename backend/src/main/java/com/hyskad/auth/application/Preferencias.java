package com.hyskad.auth.application;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

/** Preferencias del usuario autenticado. */
public record Preferencias(@NotNull @Pattern(regexp = "^(es|en)$", message = "IDIOMA_INVALIDO") String idioma) {
}

package com.hyskad.shared.error;

/** Error de validación de un campo: {@code campo} con notación de propiedad y {@code code} estable. */
public record ErrorCampo(String campo, String code) {
}

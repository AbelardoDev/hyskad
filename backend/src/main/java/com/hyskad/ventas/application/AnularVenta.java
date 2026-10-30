package com.hyskad.ventas.application;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Anulación de una venta (RN-21): el motivo es obligatorio. */
public record AnularVenta(@NotBlank @Size(min = 5, max = 500) String motivo) {
}

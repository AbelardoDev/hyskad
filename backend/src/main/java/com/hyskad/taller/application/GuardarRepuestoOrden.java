package com.hyskad.taller.application;

import java.math.BigDecimal;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;

/**
 * Repuesto de la orden (RN-29). Al agregar se indica el producto; al editar solo la nueva cantidad
 * ({@code productoId} se ignora).
 */
public record GuardarRepuestoOrden(
        @NotNull Long version,
        Long productoId,
        @NotNull @DecimalMin(value = "0", inclusive = false) @Digits(integer = 10, fraction = 2) BigDecimal cantidad) {
}

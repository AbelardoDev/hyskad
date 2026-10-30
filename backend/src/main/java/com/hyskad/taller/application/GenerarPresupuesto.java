package com.hyskad.taller.application;

import java.math.BigDecimal;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Envía el presupuesto (RN-31, RN-32): el descuento va de 0 al subtotal de la orden. */
public record GenerarPresupuesto(
        @NotNull Long version,
        @NotNull @DecimalMin("0") @Digits(integer = 13, fraction = 2) BigDecimal descuento,
        @Size(max = 1000) String observaciones) {
}

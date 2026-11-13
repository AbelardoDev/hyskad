package com.hyskad.taller.application;

import java.math.BigDecimal;

import com.hyskad.shared.dinero.MetodoPago;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * RN-35: pago de la orden por su total exacto. Referencia obligatoria salvo en efectivo y
 * {@code montoRecibido} solo cuenta en efectivo (RN-20).
 */
public record RegistrarPago(
        @NotNull @DecimalMin("0") @Digits(integer = 13, fraction = 2) BigDecimal monto,
        @NotNull MetodoPago metodo,
        @Size(max = 60) String referencia,
        @DecimalMin("0") @Digits(integer = 13, fraction = 2) BigDecimal montoRecibido) {
}

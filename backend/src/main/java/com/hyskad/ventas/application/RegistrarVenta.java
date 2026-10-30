package com.hyskad.ventas.application;

import java.math.BigDecimal;
import java.util.List;

import com.hyskad.ventas.domain.MetodoPago;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Venta a registrar (RN-18 a RN-20). No lleva precios: se usa el precio de venta vigente de cada
 * producto. {@code clienteId} vacío es consumidor final; {@code montoRecibido} solo cuenta en efectivo.
 */
public record RegistrarVenta(
        Long clienteId,
        @NotEmpty @Size(max = VentaService.MAX_ITEMS) List<@Valid @NotNull Item> items,
        @NotNull @DecimalMin("0") @Digits(integer = 13, fraction = 2) BigDecimal descuento,
        @NotNull MetodoPago metodoPago,
        @Size(max = 60) String referenciaPago,
        @DecimalMin("0") @Digits(integer = 13, fraction = 2) BigDecimal montoRecibido) {

    public record Item(
            @NotNull Long productoId,
            @NotNull @DecimalMin(value = "0", inclusive = false) @Digits(integer = 10, fraction = 2) BigDecimal cantidad) {
    }
}

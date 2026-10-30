package com.hyskad.compras.application;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Compra a registrar (RF21, RN-16): proveedor, factura y fecha (no futura), y al menos un ítem
 * con cantidad > 0 y costo unitario sin IVA ≥ 0. Que los productos existan, estén activos y no se
 * repitan lo valida el servicio.
 */
public record RegistrarCompra(
        @NotNull Long proveedorId,
        @NotBlank @Size(max = 40) String numeroFacturaProveedor,
        @NotNull LocalDate fecha,
        @NotEmpty @Size(max = CompraService.MAX_ITEMS) List<@Valid @NotNull Item> items) {

    public record Item(
            @NotNull Long productoId,
            @NotNull @DecimalMin(value = "0", inclusive = false) @Digits(integer = 10, fraction = 2) BigDecimal cantidad,
            @NotNull @DecimalMin("0") @Digits(integer = 13, fraction = 2) BigDecimal costoUnitario) {
    }
}

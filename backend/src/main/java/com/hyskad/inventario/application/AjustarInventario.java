package com.hyskad.inventario.application;

import java.math.BigDecimal;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Ajuste manual de existencias (RF18, RN-13): motivo de 10 a 500 caracteres. {@code costoUnitario}
 * solo aplica a entradas y es opcional (sin él entra al costo promedio vigente).
 */
public record AjustarInventario(
        @NotNull Long productoId,
        @NotNull TipoAjuste tipo,
        @NotNull @DecimalMin(value = "0", inclusive = false) @Digits(integer = 10, fraction = 2) BigDecimal cantidad,
        @DecimalMin("0") @Digits(integer = 13, fraction = 2) BigDecimal costoUnitario,
        @NotBlank @Size(min = InventarioService.MOTIVO_MINIMO, max = 500) String motivo) {
}

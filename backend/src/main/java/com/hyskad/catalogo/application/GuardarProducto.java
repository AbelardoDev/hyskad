package com.hyskad.catalogo.application;

import java.math.BigDecimal;

import com.hyskad.catalogo.domain.Unidad;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Datos de catálogo de un producto (RF17). El stock no se envía: nace en 0 y solo cambia con
 * movimientos de inventario. El código se guarda en mayúsculas.
 */
public record GuardarProducto(
        @NotBlank @Size(max = 40) @Pattern(regexp = CODIGO, message = "CODIGO_INVALIDO") String codigo,
        @NotBlank @Size(max = 150) String nombre,
        @Size(max = 500) String descripcion,
        @Size(max = 80) String marca,
        @NotNull Long categoriaId,
        @NotNull Unidad unidad,
        @NotNull @DecimalMin(value = "0", inclusive = false) @Digits(integer = 13, fraction = 2) BigDecimal precioVenta,
        @NotNull @DecimalMin("0") @Digits(integer = 10, fraction = 2) BigDecimal stockMinimo) {

    /** Letras, números y separadores comunes en referencias de repuestos (`-`, `_`, `.`, `/`). */
    static final String CODIGO = "^\s*[A-Za-z0-9][A-Za-z0-9._/-]*\s*$";
}

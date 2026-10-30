package com.hyskad.taller.application;

import java.math.BigDecimal;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

/**
 * Servicio de la orden (RN-30). Con {@code servicioId} sale del catálogo: la descripción y el precio
 * vacíos toman los del catálogo. Sin él es mano de obra libre y ambos son obligatorios. Al editar,
 * {@code servicioId} se ignora. El mecánico, si viene, debe estar asignado a la orden.
 */
public record GuardarServicioOrden(
        @NotNull Long version,
        Long servicioId,
        @Size(max = 200) String descripcion,
        @DecimalMin(value = "0", inclusive = false) @Digits(integer = 13, fraction = 2) BigDecimal precio,
        @Positive @Max(10_080) Integer tiempoMin,
        Long mecanicoId) {
}

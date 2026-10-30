package com.hyskad.servicios.application;

import java.math.BigDecimal;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

/** Datos para crear o editar un servicio del catálogo (RF16). El tiempo va en minutos. */
public record GuardarServicio(
        @NotBlank @Size(max = 120) String nombre,
        @Size(max = 500) String descripcion,
        @NotNull @DecimalMin(value = "0", inclusive = false) @Digits(integer = 13, fraction = 2) BigDecimal precioBase,
        @NotNull @Positive @Max(MAX_MINUTOS) Integer tiempoEstimadoMin) {

    /** Una semana de trabajo continuo: más que eso es un error de digitación. */
    static final int MAX_MINUTOS = 10_080;
}

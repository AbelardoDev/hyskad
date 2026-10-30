package com.hyskad.taller.application;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Corrige los datos de recepción de una orden activa; {@code version} es la que leyó el cliente. */
public record ActualizarRecepcion(
        @NotNull Long version,
        @NotBlank @Size(max = 200) String motivoIngreso,
        @NotBlank @Size(max = 2000) String descripcionProblema,
        @Size(max = 2000) String observaciones) {
}

package com.hyskad.taller.application;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

/**
 * Recepción de una moto (RF10, RN-25). Los mecánicos son opcionales y, si vienen, exigen
 * {@code ORDENES_ASIGNAR}.
 */
public record CrearOrden(
        @NotNull Long clienteId,
        @NotNull Long motocicletaId,
        @NotNull @PositiveOrZero @Max(OrdenTrabajoService.MAX_KILOMETRAJE) Integer kilometrajeIngreso,
        @NotBlank @Size(max = 200) String motivoIngreso,
        @NotBlank @Size(max = 2000) String descripcionProblema,
        @Size(max = 2000) String observaciones,
        @Size(max = OrdenTrabajoService.MAX_MECANICOS) List<@Valid @NotNull AsignacionMecanico> mecanicos) {
}

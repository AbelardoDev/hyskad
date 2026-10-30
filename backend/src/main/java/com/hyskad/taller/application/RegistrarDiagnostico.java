package com.hyskad.taller.application;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

/** Diagnóstico de la orden (RF14). El kilometraje de inspección, si viene, no baja del de ingreso. */
public record RegistrarDiagnostico(
        @NotNull Long version,
        @NotBlank @Size(max = 4000) String diagnostico,
        @Size(max = 2000) String observaciones,
        @PositiveOrZero @Max(OrdenTrabajoService.MAX_KILOMETRAJE) Integer kilometrajeInspeccion) {
}

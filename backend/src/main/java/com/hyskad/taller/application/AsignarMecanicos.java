package com.hyskad.taller.application;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Reemplaza los mecánicos de la orden (RN-26); una lista vacía los quita todos. */
public record AsignarMecanicos(
        @NotNull Long version,
        @NotNull @Size(max = OrdenTrabajoService.MAX_MECANICOS) List<@Valid @NotNull AsignacionMecanico> mecanicos) {
}

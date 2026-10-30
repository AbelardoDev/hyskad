package com.hyskad.taller.application;

import com.hyskad.taller.domain.EstadoPresupuesto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** RN-33: decisión del cliente, {@code APROBADO} o {@code RECHAZADO}. */
public record DecidirPresupuesto(@NotNull EstadoPresupuesto decision, @Size(max = 1000) String observaciones) {
}

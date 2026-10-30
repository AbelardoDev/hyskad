package com.hyskad.taller.application;

import com.hyskad.taller.domain.EstadoOrden;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Cambio de estado pedido por un usuario (RF13). Cancelar y "requiere ajuste" exigen nota. */
public record SolicitarTransicion(
        @NotNull Long version,
        @NotNull EstadoOrden estado,
        @Size(max = 500) String nota) {
}

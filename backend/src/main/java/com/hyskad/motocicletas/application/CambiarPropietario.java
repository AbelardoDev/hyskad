package com.hyskad.motocicletas.application;

import jakarta.validation.constraints.NotNull;

/** Nuevo propietario de la moto (RN-43): debe ser un cliente activo. */
public record CambiarPropietario(@NotNull Long clienteId) {
}

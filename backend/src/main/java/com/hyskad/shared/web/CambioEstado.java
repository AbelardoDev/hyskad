package com.hyskad.shared.web;

import jakarta.validation.constraints.NotNull;

/** Cuerpo de {@code PATCH /{recurso}/{id}/estado}: activa o desactiva (baja lógica). */
public record CambioEstado(@NotNull Boolean activo) {
}

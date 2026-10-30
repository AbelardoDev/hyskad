package com.hyskad.usuarios.application;

import jakarta.validation.constraints.NotNull;

/** Activa o desactiva un usuario (RF3). */
public record CambiarEstadoUsuario(@NotNull Boolean activo) {
}

package com.hyskad.auth.application;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Pedido de enlace de recuperación (RF35). */
public record SolicitarRecuperacion(@NotBlank @Size(max = 254) String email) {

    @Override
    public String toString() {
        return "SolicitarRecuperacion[***]";
    }
}

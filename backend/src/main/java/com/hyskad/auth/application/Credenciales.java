package com.hyskad.auth.application;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Datos del login. Sin validar formato de email: cualquier fallo debe verse igual (RN-49). */
public record Credenciales(@NotBlank @Size(max = 254) String email, @NotBlank @Size(max = 200) String password) {

    @Override
    public String toString() {
        return "Credenciales[***]";
    }
}

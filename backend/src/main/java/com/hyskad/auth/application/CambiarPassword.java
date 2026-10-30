package com.hyskad.auth.application;

import com.hyskad.shared.validation.PasswordSegura;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Cambio de contraseña por el usuario autenticado. */
public record CambiarPassword(@NotBlank @Size(max = 200) String actual, @NotNull @PasswordSegura String nueva) {

    @Override
    public String toString() {
        return "CambiarPassword[***]";
    }
}

package com.hyskad.auth.application;

import com.hyskad.shared.validation.PasswordSegura;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Nueva contraseña con el token del enlace de recuperación. */
public record RestablecerPassword(@NotBlank @Size(max = 100) String token, @NotNull @PasswordSegura String nueva) {

    @Override
    public String toString() {
        return "RestablecerPassword[***]";
    }
}

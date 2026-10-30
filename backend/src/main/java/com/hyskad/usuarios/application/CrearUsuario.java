package com.hyskad.usuarios.application;

import com.hyskad.shared.validation.PasswordSegura;
import com.hyskad.usuarios.domain.Rol;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Datos para crear un usuario (RF1). {@code idioma} es opcional: por defecto {@code es}. */
public record CrearUsuario(
        @NotBlank @Size(max = 120) String nombre,
        @NotBlank @Email @Size(max = 254) String email,
        @Size(max = 20) @Pattern(regexp = DatosUsuario.TELEFONO, message = "TELEFONO_INVALIDO") String telefono,
        @NotNull @PasswordSegura String password,
        @NotNull Rol rol,
        @Pattern(regexp = DatosUsuario.IDIOMA, message = "IDIOMA_INVALIDO") String idioma) {

    @Override
    public String toString() {
        return "CrearUsuario[rol=" + rol + "]";
    }
}

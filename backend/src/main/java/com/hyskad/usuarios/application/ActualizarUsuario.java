package com.hyskad.usuarios.application;

import com.hyskad.usuarios.domain.Rol;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** Datos editables de un usuario por el administrador. La contraseña no se cambia aquí. */
public record ActualizarUsuario(
        @NotBlank @Size(max = 120) String nombre,
        @NotBlank @Email @Size(max = 254) String email,
        @Size(max = 20) @Pattern(regexp = DatosUsuario.TELEFONO, message = "TELEFONO_INVALIDO") String telefono,
        @NotNull Rol rol) {
}

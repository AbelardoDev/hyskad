package com.hyskad.usuarios.web.dto;

import java.time.Instant;

import com.hyskad.usuarios.domain.Rol;

/** Usuario para la administración. Nunca incluye el hash de la contraseña. */
public record UsuarioResponse(Long id, String nombre, String email, String telefono, Rol rol, boolean activo,
        String idioma, Instant ultimoAcceso, boolean debeCambiarPassword, Instant createdAt) {
}

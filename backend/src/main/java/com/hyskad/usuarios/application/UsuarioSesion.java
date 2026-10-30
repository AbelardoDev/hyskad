package com.hyskad.usuarios.application;

import java.util.List;

import com.hyskad.usuarios.domain.Rol;

/**
 * Lo que el módulo de autenticación necesita de un usuario activo: identidad, rol, permisos
 * efectivos (ordenados) y preferencias. Nunca incluye el hash de la contraseña.
 */
public record UsuarioSesion(Long id, String nombre, String email, Rol rol, List<String> permisos, String idioma,
        boolean debeCambiarPassword) {
}

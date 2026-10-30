package com.hyskad.usuarios.domain;

/**
 * Se desactivó al usuario o cambiaron su rol o sus permisos (RN-48). Se publica dentro de la
 * transacción para que el módulo que gestiona las sesiones las revoque en esa misma transacción.
 */
public record AccesoUsuarioModificado(Long usuarioId) {
}

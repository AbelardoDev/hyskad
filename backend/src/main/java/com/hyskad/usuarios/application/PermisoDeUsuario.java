package com.hyskad.usuarios.application;

import com.hyskad.usuarios.domain.Permiso;

/**
 * Estado de un permiso para un usuario: si lo trae su rol, el ajuste guardado ({@code null} si no
 * hay), si lo tiene efectivamente y si el administrador puede cambiarlo.
 */
public record PermisoDeUsuario(Permiso permiso, boolean delRol, TipoAjuste ajuste, boolean efectivo,
        boolean editable, boolean soloAdmin) {
}

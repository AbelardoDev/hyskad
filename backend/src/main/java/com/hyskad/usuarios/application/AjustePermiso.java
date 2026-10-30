package com.hyskad.usuarios.application;

import com.hyskad.usuarios.domain.Permiso;

import jakarta.validation.constraints.NotNull;

/** Concede ({@code true}) o retira ({@code false}) un permiso a un usuario. */
public record AjustePermiso(@NotNull Permiso permiso, @NotNull Boolean concedido) {
}

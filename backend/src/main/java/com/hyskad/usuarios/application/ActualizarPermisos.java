package com.hyskad.usuarios.application;

import java.util.List;
import java.util.Objects;

import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotNull;

/** Ajustes completos de un usuario: reemplazan a los anteriores. Lista vacía = solo los del rol. */
public record ActualizarPermisos(@NotNull List<@Valid @NotNull AjustePermiso> ajustes) {

    @AssertTrue(message = "PERMISO_REPETIDO")
    boolean isSinRepetidos() {
        return ajustes == null || ajustes.stream().filter(Objects::nonNull).map(AjustePermiso::permiso)
                .distinct().count() == ajustes.stream().filter(Objects::nonNull).count();
    }
}

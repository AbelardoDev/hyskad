package com.hyskad.usuarios.application;

/** Ajuste de un usuario sobre un permiso de su rol. */
public enum TipoAjuste {
    CONCEDIDO,
    RETIRADO;

    static TipoAjuste de(Boolean concedido) {
        if (concedido == null) {
            return null;
        }
        return concedido ? CONCEDIDO : RETIRADO;
    }
}

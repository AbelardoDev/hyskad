package com.hyskad.inventario.domain;

import java.util.Objects;

/**
 * Documento que origina un movimiento (compra, venta, orden). Se guarda sin FK para no acoplar el
 * inventario a esos módulos; {@code numero} es el consecutivo visible (p. ej. {@code V-000012}).
 */
public record Referencia(TipoReferencia tipo, Long id, String numero) {

    public Referencia {
        Objects.requireNonNull(tipo, "tipo");
    }

    public enum TipoReferencia {
        COMPRA, VENTA, ORDEN_TRABAJO
    }
}

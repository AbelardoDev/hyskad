package com.hyskad.inventario.domain;

/** Tipos de movimiento de inventario (RN-11). */
public enum TipoMovimiento {
    ENTRADA_COMPRA(true),
    SALIDA_VENTA(false),
    SALIDA_ORDEN(false),
    ENTRADA_AJUSTE(true),
    SALIDA_AJUSTE(false),
    DEVOLUCION_ANULACION_VENTA(true),
    SALIDA_ANULACION_COMPRA(false);

    private final boolean entrada;

    TipoMovimiento(boolean entrada) {
        this.entrada = entrada;
    }

    public boolean esEntrada() {
        return entrada;
    }
}

package com.hyskad.shared.consecutivo;

/** Tipos de documento numerados y su prefijo (RN-52). */
public enum TipoConsecutivo {

    OT("OT"),
    VENTA("V"),
    COMPRA("C"),
    PRESUPUESTO("P");

    private final String prefijo;

    TipoConsecutivo(String prefijo) {
        this.prefijo = prefijo;
    }

    public String prefijo() {
        return prefijo;
    }
}

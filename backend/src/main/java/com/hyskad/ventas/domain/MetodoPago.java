package com.hyskad.ventas.domain;

/** RN-20: la venta se paga completa con uno de estos métodos. Solo el efectivo no lleva referencia. */
public enum MetodoPago {
    EFECTIVO, TRANSFERENCIA, TARJETA, OTRO;

    public boolean requiereReferencia() {
        return this != EFECTIVO;
    }
}

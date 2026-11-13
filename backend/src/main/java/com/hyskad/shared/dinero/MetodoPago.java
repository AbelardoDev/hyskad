package com.hyskad.shared.dinero;

/** RN-20 y RN-35: la venta o la orden se paga completa con uno de estos métodos. Solo el efectivo no lleva referencia. */
public enum MetodoPago {
    EFECTIVO, TRANSFERENCIA, TARJETA, OTRO;

    public boolean requiereReferencia() {
        return this != EFECTIVO;
    }
}

package com.hyskad.taller.domain;

import java.math.BigDecimal;

import com.hyskad.shared.dinero.MetodoPago;

/** Pago ya validado (referencia y monto recibido) que la orden registra. */
public record DatosPago(BigDecimal monto, MetodoPago metodo, String referencia, BigDecimal montoRecibido) {
}

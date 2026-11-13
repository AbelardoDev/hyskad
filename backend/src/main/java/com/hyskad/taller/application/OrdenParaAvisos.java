package com.hyskad.taller.application;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * Lo que las notificaciones y los correos (F10) necesitan saber de una orden, ya cargado: quién la
 * creó, sus mecánicos, la moto, los ítems, los totales y el pago. Sin costos.
 */
public record OrdenParaAvisos(Long id, String numero, String estado, Long clienteId, String placa, String moto,
        String motivoIngreso, Instant fechaIngreso, Instant fechaEntrega, Long creadaPor, List<Long> mecanicos,
        List<Linea> lineas, BigDecimal subtotal, BigDecimal descuento, BigDecimal ivaPorcentaje,
        BigDecimal impuesto, BigDecimal total, Pago pago) {

    /** Servicio (cantidad 1) o repuesto de la orden o del presupuesto. */
    public record Linea(String descripcion, BigDecimal cantidad, BigDecimal precioUnitario, BigDecimal subtotal) {
    }

    public record Pago(String metodo, BigDecimal monto, Instant fecha) {
    }
}

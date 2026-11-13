package com.hyskad.reportes.application;

import java.math.BigDecimal;
import java.time.Instant;

/** RN-37: una orden finalizada sin pago con los días transcurridos desde la finalización. */
public record CuentaPendiente(Long ordenId, String numero, Long clienteId, String cliente, String telefono,
        String placa, String moto, Instant fechaFinalizacion, long diasTranscurridos, BigDecimal total) {
}

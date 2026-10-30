package com.hyskad.taller.domain;

import java.math.BigDecimal;

/** Servicio de la orden ya validado: descripción, precio acordado, tiempo y mecánico (opcionales). */
public record DatosServicioOrden(String descripcion, BigDecimal precio, Integer tiempoMin, Long mecanicoId) {
}

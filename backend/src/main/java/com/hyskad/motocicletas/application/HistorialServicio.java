package com.hyskad.motocicletas.application;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * Una orden de trabajo en el historial de la moto (RF9): fechas, kilometraje, diagnóstico,
 * servicios, repuestos, total y mecánicos. {@code estado} es el nombre del estado de la orden
 * (el enum vive en {@code taller}). Sin costos.
 */
public record HistorialServicio(Long ordenId, String numero, String estado, Instant fechaIngreso,
        Instant fechaFinalizacion, Instant fechaEntrega, int kilometrajeIngreso, Integer kilometrajeInspeccion,
        String motivoIngreso, String diagnostico, List<Servicio> servicios, List<Repuesto> repuestos,
        BigDecimal total, List<String> mecanicos) {

    public record Servicio(String descripcion, BigDecimal precio) {
    }

    public record Repuesto(String codigo, String nombre, BigDecimal cantidad, BigDecimal precioUnitario,
            BigDecimal subtotal) {
    }
}

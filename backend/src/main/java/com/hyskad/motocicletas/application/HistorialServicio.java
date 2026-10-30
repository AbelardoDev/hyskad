package com.hyskad.motocicletas.application;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * Una orden de trabajo en el historial de la moto (RF9), con su forma definitiva. Se llena en
 * F09C, cuando exista el módulo {@code taller}; hasta entonces el historial siempre está vacío.
 */
public record HistorialServicio(Long ordenId, String numero, Instant fechaIngreso, Instant fechaEntrega,
        String estado, Integer kilometraje, String motivoIngreso, List<Servicio> servicios,
        List<Repuesto> repuestos, BigDecimal total) {

    public record Servicio(String descripcion, BigDecimal precio) {
    }

    public record Repuesto(String codigo, String nombre, int cantidad, BigDecimal precioUnitario) {
    }
}

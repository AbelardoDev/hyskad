package com.hyskad.servicios.web.dto;

import java.math.BigDecimal;
import java.time.Instant;

public record ServicioResponse(Long id, String nombre, String descripcion, BigDecimal precioBase,
        int tiempoEstimadoMin, boolean activo, Instant createdAt) {
}

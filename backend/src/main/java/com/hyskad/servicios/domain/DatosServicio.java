package com.hyskad.servicios.domain;

import java.math.BigDecimal;

/** Datos ya validados y normalizados de un servicio del catálogo. */
public record DatosServicio(String nombre, String descripcion, BigDecimal precioBase, int tiempoEstimadoMin) {
}

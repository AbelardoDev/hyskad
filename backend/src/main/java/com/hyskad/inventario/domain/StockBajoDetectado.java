package com.hyskad.inventario.domain;

import java.math.BigDecimal;

/**
 * RN-14: el disponible de un producto llegó al mínimo (o por debajo) y antes no lo estaba. Lo
 * escucha el módulo de notificaciones (F10) después del commit.
 */
public record StockBajoDetectado(Long productoId, String codigo, String nombre, BigDecimal stockDisponible,
        BigDecimal stockMinimo) {
}

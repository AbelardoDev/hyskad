package com.hyskad.inventario.application;

import java.time.Instant;

import com.hyskad.inventario.domain.TipoMovimiento;

/** Filtros de la consulta de movimientos; todos opcionales. {@code hasta} es exclusivo. */
public record FiltroMovimientos(Long productoId, TipoMovimiento tipo, Instant desde, Instant hasta, Long usuarioId) {
}

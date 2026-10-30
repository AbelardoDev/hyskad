package com.hyskad.compras.application;

import java.time.LocalDate;

import com.hyskad.compras.domain.EstadoCompra;

/** Filtros del listado de compras; todos opcionales. Fechas inclusivas. */
public record FiltroCompras(Long proveedorId, LocalDate desde, LocalDate hasta, EstadoCompra estado, String numero) {
}

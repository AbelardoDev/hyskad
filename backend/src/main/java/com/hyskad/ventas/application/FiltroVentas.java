package com.hyskad.ventas.application;

import java.time.LocalDate;

import com.hyskad.ventas.domain.EstadoVenta;
import com.hyskad.ventas.domain.MetodoPago;

/** Filtros del listado de ventas; todos opcionales. Las fechas son días de Colombia, inclusivos. */
public record FiltroVentas(LocalDate desde, LocalDate hasta, Long clienteId, Long vendedorId, MetodoPago metodo,
        EstadoVenta estado, String numero) {
}

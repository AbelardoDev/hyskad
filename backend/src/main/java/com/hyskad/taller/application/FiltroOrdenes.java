package com.hyskad.taller.application;

import java.time.LocalDate;
import java.util.Set;

import com.hyskad.taller.domain.EstadoOrden;

/** Filtros del tablero (RF29); {@code desde} y {@code hasta} son días de Colombia, inclusivos. */
public record FiltroOrdenes(String texto, Set<EstadoOrden> estados, Long mecanicoId, LocalDate desde,
        LocalDate hasta) {
}

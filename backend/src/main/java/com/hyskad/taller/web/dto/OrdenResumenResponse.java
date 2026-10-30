package com.hyskad.taller.web.dto;

import java.time.Instant;
import java.util.List;

import com.hyskad.taller.domain.EstadoOrden;

/** Orden en el tablero (lista y kanban): lo justo para identificarla y ver quién la trabaja. */
public record OrdenResumenResponse(Long id, String numero, EstadoOrden estado, Instant fechaIngreso, String placa,
        String moto, String cliente, List<UsuarioResumen> mecanicos) {
}

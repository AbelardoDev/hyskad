package com.hyskad.taller.web.dto;

import java.time.Instant;
import java.util.List;

import com.hyskad.taller.domain.EstadoOrden;

/**
 * Orden en el tablero (lista y kanban) y en "Mis órdenes": lo justo para identificarla, saber a qué
 * vino y ver quién la trabaja.
 */
public record OrdenResumenResponse(Long id, String numero, EstadoOrden estado, Instant fechaIngreso, String placa,
        String moto, String cliente, String motivoIngreso, List<UsuarioResumen> mecanicos) {
}

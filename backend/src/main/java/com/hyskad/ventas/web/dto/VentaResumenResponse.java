package com.hyskad.ventas.web.dto;

import java.math.BigDecimal;
import java.time.Instant;

import com.hyskad.ventas.domain.EstadoVenta;
import com.hyskad.ventas.domain.MetodoPago;

/** Venta en listados: sin ítems. */
public record VentaResumenResponse(Long id, String numero, Instant fecha, String cliente,
        VentaResponse.UsuarioResumen vendedor, MetodoPago metodoPago, BigDecimal total, EstadoVenta estado) {
}

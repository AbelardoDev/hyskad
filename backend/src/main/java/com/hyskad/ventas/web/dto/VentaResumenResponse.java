package com.hyskad.ventas.web.dto;

import java.math.BigDecimal;
import java.time.Instant;

import com.hyskad.shared.dinero.MetodoPago;
import com.hyskad.ventas.domain.EstadoVenta;

/** Venta en listados: sin ítems. */
public record VentaResumenResponse(Long id, String numero, Instant fecha, String cliente,
        VentaResponse.UsuarioResumen vendedor, MetodoPago metodoPago, BigDecimal total, EstadoVenta estado) {
}

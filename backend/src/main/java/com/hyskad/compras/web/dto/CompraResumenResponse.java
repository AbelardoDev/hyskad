package com.hyskad.compras.web.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

import com.hyskad.compras.domain.EstadoCompra;

/** Compra en listados: sin ítems. */
public record CompraResumenResponse(Long id, String numero, CompraResponse.ProveedorResumen proveedor,
        String numeroFacturaProveedor, LocalDate fecha, BigDecimal total, EstadoCompra estado) {
}

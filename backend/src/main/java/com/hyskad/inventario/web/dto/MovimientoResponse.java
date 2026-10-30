package com.hyskad.inventario.web.dto;

import java.math.BigDecimal;
import java.time.Instant;

import com.hyskad.catalogo.domain.Unidad;
import com.hyskad.inventario.domain.Referencia;
import com.hyskad.inventario.domain.TipoMovimiento;

/** Movimiento de inventario con el producto, la referencia y quién lo hizo (si fue una persona). */
public record MovimientoResponse(Long id, Instant fecha, TipoMovimiento tipo, BigDecimal cantidad,
        BigDecimal costoUnitario, BigDecimal stockResultante, ProductoResumen producto, ReferenciaResumen referencia,
        String motivo, UsuarioResumen usuario) {

    public record ProductoResumen(Long id, String codigo, String nombre, Unidad unidad) {
    }

    public record ReferenciaResumen(Referencia.TipoReferencia tipo, Long id, String numero) {
    }

    public record UsuarioResumen(Long id, String nombre) {
    }
}

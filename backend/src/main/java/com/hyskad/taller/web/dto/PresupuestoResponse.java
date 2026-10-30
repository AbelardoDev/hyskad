package com.hyskad.taller.web.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

import com.hyskad.taller.domain.EstadoPresupuesto;
import com.hyskad.taller.domain.Presupuesto;

/** Presupuesto con sus ítems y totales congelados (RN-31). */
public record PresupuestoResponse(Long id, Long ordenId, String numero, int version, EstadoPresupuesto estado,
        List<Item> items, BigDecimal subtotal, BigDecimal descuento, BigDecimal ivaPorcentaje, BigDecimal impuesto,
        BigDecimal total, String observaciones, Instant fechaEnvio, UsuarioResumen enviadoPor, Instant fechaDecision,
        UsuarioResumen decididoPor, String observacionesDecision) {

    public record Item(Presupuesto.TipoItem tipo, String descripcion, BigDecimal cantidad, BigDecimal precioUnitario,
            BigDecimal subtotal) {
    }
}

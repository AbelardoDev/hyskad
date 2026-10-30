package com.hyskad.catalogo.web.dto;

import java.math.BigDecimal;
import java.time.Instant;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.hyskad.catalogo.domain.EstadoStock;
import com.hyskad.catalogo.domain.Unidad;

/**
 * Producto con sus existencias. {@code stockDisponible} y {@code estadoStock} son calculados.
 * {@code costoPromedio} solo viaja a quien tiene {@code PRODUCTOS_GESTIONAR} (si no, se omite).
 */
public record ProductoResponse(Long id, String codigo, String nombre, String descripcion, String marca,
        CategoriaResumen categoria, Unidad unidad, BigDecimal precioVenta,
        @JsonInclude(JsonInclude.Include.NON_NULL) BigDecimal costoPromedio, BigDecimal stockActual,
        BigDecimal stockReservado, BigDecimal stockDisponible, BigDecimal stockMinimo, EstadoStock estadoStock,
        boolean activo, Instant createdAt) {

    public record CategoriaResumen(Long id, String nombre) {
    }

    public ProductoResponse sinCosto() {
        return new ProductoResponse(id, codigo, nombre, descripcion, marca, categoria, unidad, precioVenta, null,
                stockActual, stockReservado, stockDisponible, stockMinimo, estadoStock, activo, createdAt);
    }
}

package com.hyskad.catalogo.domain;

import java.math.BigDecimal;

/** Datos de catálogo ya validados y normalizados (sin existencias ni costo). */
public record DatosProducto(String codigo, String nombre, String descripcion, String marca, Unidad unidad,
        BigDecimal precioVenta, BigDecimal stockMinimo) {
}

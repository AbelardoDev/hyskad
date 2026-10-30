package com.hyskad.ventas.persistence;

import java.math.BigDecimal;

import org.springframework.data.jpa.domain.Specification;

import com.hyskad.ventas.domain.Venta;

/** Agregados de las ventas filtradas, calculados en la BD (no se traen las filas). */
public interface VentaResumenRepository {

    Resumen resumir(Specification<Venta> filtro);

    record Resumen(long cantidad, BigDecimal total) {
    }
}

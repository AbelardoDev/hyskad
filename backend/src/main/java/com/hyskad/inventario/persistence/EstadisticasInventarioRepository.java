package com.hyskad.inventario.persistence;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import com.hyskad.shared.persistence.FechasSql;

/**
 * Consultas agregadas de solo lectura sobre existencias y movimientos (RF33, RF34). El disponible
 * es {@code stock_actual − stock_reservado}; el stock bajo es disponible ≤ mínimo (RN-14).
 */
@Repository
public class EstadisticasInventarioRepository {

    private static final String DISPONIBLE = "(p.stock_actual - p.stock_reservado)";

    private final NamedParameterJdbcTemplate jdbc;

    public EstadisticasInventarioRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Productos activos con existencias y costo promedio, filtrables por categoría. */
    public List<FilaProducto> productos(Long categoriaId) {
        return jdbc.query("""
                SELECT p.id, p.codigo, p.nombre, c.nombre AS categoria, p.unidad, p.stock_actual, p.stock_reservado,
                       p.stock_minimo, p.costo_promedio
                FROM producto p JOIN categoria c ON c.id = p.categoria_id
                WHERE p.activo = TRUE AND (:categoriaId IS NULL OR p.categoria_id = :categoriaId)
                ORDER BY p.nombre, p.id""", new MapSqlParameterSource("categoriaId", categoriaId),
                (rs, i) -> new FilaProducto(rs.getLong("id"), rs.getString("codigo"), rs.getString("nombre"),
                        rs.getString("categoria"), rs.getString("unidad"), rs.getBigDecimal("stock_actual"),
                        rs.getBigDecimal("stock_reservado"), rs.getBigDecimal("stock_minimo"),
                        rs.getBigDecimal("costo_promedio")));
    }

    /** Movimientos del rango agrupados por tipo, con unidades y valor a su costo. */
    public List<FilaMovimiento> movimientosPorTipo(Instant inicio, Instant fin) {
        return jdbc.query("""
                SELECT m.tipo, COUNT(*) AS cantidad, SUM(m.cantidad) AS unidades,
                       SUM(m.cantidad * m.costo_unitario) AS valor
                FROM movimiento_inventario m
                WHERE m.fecha >= :inicio AND m.fecha < :fin
                GROUP BY m.tipo ORDER BY m.tipo""", rango(inicio, fin),
                (rs, i) -> new FilaMovimiento(rs.getString("tipo"), rs.getLong("cantidad"),
                        rs.getBigDecimal("unidades"), rs.getBigDecimal("valor")));
    }

    /** Los productos activos más críticos: menor diferencia entre disponible y mínimo, entre los de stock bajo. */
    public List<FilaProducto> stockCritico(int limite) {
        return jdbc.query("""
                SELECT p.id, p.codigo, p.nombre, c.nombre AS categoria, p.unidad, p.stock_actual, p.stock_reservado,
                       p.stock_minimo, p.costo_promedio
                FROM producto p JOIN categoria c ON c.id = p.categoria_id
                WHERE p.activo = TRUE AND %1$s <= p.stock_minimo
                ORDER BY %1$s - p.stock_minimo, p.nombre
                LIMIT :limite""".formatted(DISPONIBLE), new MapSqlParameterSource("limite", limite),
                (rs, i) -> new FilaProducto(rs.getLong("id"), rs.getString("codigo"), rs.getString("nombre"),
                        rs.getString("categoria"), rs.getString("unidad"), rs.getBigDecimal("stock_actual"),
                        rs.getBigDecimal("stock_reservado"), rs.getBigDecimal("stock_minimo"),
                        rs.getBigDecimal("costo_promedio")));
    }

    public long conStockBajo() {
        return jdbc.queryForObject("SELECT COUNT(*) FROM producto p WHERE p.activo = TRUE AND " + DISPONIBLE
                + " <= p.stock_minimo", new MapSqlParameterSource(), Long.class);
    }

    /** Repuestos más usados: salidas por venta y por orden menos devoluciones de ventas anuladas. */
    public List<FilaUso> masUsados(Instant inicio, Instant fin, int limite) {
        return jdbc.query("""
                SELECT p.id, p.codigo, p.nombre,
                       SUM(CASE WHEN m.tipo = 'DEVOLUCION_ANULACION_VENTA' THEN -m.cantidad ELSE m.cantidad END)
                           AS cantidad
                FROM movimiento_inventario m JOIN producto p ON p.id = m.producto_id
                WHERE m.tipo IN ('SALIDA_VENTA', 'SALIDA_ORDEN', 'DEVOLUCION_ANULACION_VENTA')
                  AND m.fecha >= :inicio AND m.fecha < :fin
                GROUP BY p.id, p.codigo, p.nombre
                HAVING cantidad > 0
                ORDER BY cantidad DESC, p.nombre
                LIMIT :limite""", rango(inicio, fin).addValue("limite", limite),
                (rs, i) -> new FilaUso(rs.getLong("id"), rs.getString("codigo"), rs.getString("nombre"),
                        rs.getBigDecimal("cantidad")));
    }

    private static MapSqlParameterSource rango(Instant inicio, Instant fin) {
        return new MapSqlParameterSource().addValue("inicio", FechasSql.parametro(inicio))
                .addValue("fin", FechasSql.parametro(fin));
    }

    public record FilaProducto(Long id, String codigo, String nombre, String categoria, String unidad,
            BigDecimal stockActual, BigDecimal stockReservado, BigDecimal stockMinimo, BigDecimal costoPromedio) {

        public BigDecimal disponible() {
            return stockActual.subtract(stockReservado);
        }
    }

    public record FilaMovimiento(String tipo, long cantidad, BigDecimal unidades, BigDecimal valor) {
    }

    public record FilaUso(Long id, String codigo, String nombre, BigDecimal cantidad) {
    }
}

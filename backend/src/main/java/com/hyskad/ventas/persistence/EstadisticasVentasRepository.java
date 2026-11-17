package com.hyskad.ventas.persistence;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import com.hyskad.shared.config.TiempoConfig;
import com.hyskad.shared.persistence.FechasSql;

/**
 * Consultas agregadas de solo lectura sobre las ventas pagadas (reporte de ventas y RF34). Las
 * anuladas no cuentan. Rangos {@code [inicio, fin)} en UTC; los días se agrupan en Bogotá (RN-53).
 */
@Repository
public class EstadisticasVentasRepository {

    private final NamedParameterJdbcTemplate jdbc;

    public EstadisticasVentasRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Ventas pagadas con su costo congelado (RN-09); filtros opcionales por vendedor y método. */
    public List<FilaVenta> ventas(Instant inicio, Instant fin, Long vendedorId, String metodo) {
        return jdbc.query("""
                SELECT v.id, v.numero, v.fecha, u.nombre AS vendedor, v.metodo_pago, v.subtotal, v.descuento,
                       v.impuesto, v.total,
                       (SELECT COALESCE(SUM(d.cantidad * d.costo_unitario), 0) FROM venta_detalle d
                         WHERE d.venta_id = v.id) AS costo
                FROM venta v
                LEFT JOIN usuario u ON u.id = v.created_by
                WHERE v.estado = 'PAGADA' AND v.fecha >= :inicio AND v.fecha < :fin
                  AND (:vendedorId IS NULL OR v.created_by = :vendedorId)
                  AND (:metodo IS NULL OR v.metodo_pago = :metodo)
                ORDER BY v.fecha DESC, v.id DESC""",
                rango(inicio, fin).addValue("vendedorId", vendedorId).addValue("metodo", metodo),
                (rs, i) -> new FilaVenta(rs.getLong("id"), rs.getString("numero"), FechasSql.leer(rs, "fecha"),
                        rs.getString("vendedor"), rs.getString("metodo_pago"), rs.getBigDecimal("subtotal"),
                        rs.getBigDecimal("descuento"), rs.getBigDecimal("impuesto"), rs.getBigDecimal("total"),
                        rs.getBigDecimal("costo")));
    }

    /** Cantidad y total de las ventas pagadas en el rango. */
    public Resumen resumen(Instant inicio, Instant fin) {
        return jdbc.queryForObject("""
                SELECT COUNT(*) AS cantidad, COALESCE(SUM(v.total), 0) AS total FROM venta v
                WHERE v.estado = 'PAGADA' AND v.fecha >= :inicio AND v.fecha < :fin""", rango(inicio, fin),
                (rs, i) -> new Resumen(rs.getLong("cantidad"), rs.getBigDecimal("total")));
    }

    /** RN-53: total vendido por día de Bogotá. */
    public Map<LocalDate, BigDecimal> totalPorDia(Instant inicio, Instant fin) {
        String dia = TiempoConfig.diaNegocioSql("v.fecha");
        return jdbc.query("""
                SELECT %1$s AS dia, SUM(v.total) AS total FROM venta v
                WHERE v.estado = 'PAGADA' AND v.fecha >= :inicio AND v.fecha < :fin
                GROUP BY %1$s""".formatted(dia), rango(inicio, fin),
                (rs, i) -> Map.entry(rs.getDate("dia").toLocalDate(), rs.getBigDecimal("total"))).stream()
                .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
    }

    private static MapSqlParameterSource rango(Instant inicio, Instant fin) {
        return new MapSqlParameterSource().addValue("inicio", FechasSql.parametro(inicio))
                .addValue("fin", FechasSql.parametro(fin));
    }

    public record FilaVenta(Long id, String numero, Instant fecha, String vendedor, String metodo,
            BigDecimal subtotal, BigDecimal descuento, BigDecimal impuesto, BigDecimal total, BigDecimal costo) {
    }

    public record Resumen(long cantidad, BigDecimal total) {
    }
}

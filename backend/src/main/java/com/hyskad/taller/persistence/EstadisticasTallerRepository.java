package com.hyskad.taller.persistence;

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
 * Consultas agregadas de solo lectura sobre las órdenes (RF32, RF34). Se escriben en SQL porque
 * agrupan por día de Bogotá (RN-53) y suman sobre varias tablas; los rangos son {@code [inicio, fin)}
 * en UTC. Una orden cuenta como realizada si está finalizada o entregada.
 */
@Repository
public class EstadisticasTallerRepository {

    private static final String REALIZADAS = """
            o.estado IN ('FINALIZADA', 'ENTREGADA') AND o.fecha_finalizacion >= :inicio AND o.fecha_finalizacion < :fin
            AND (:mecanicoId IS NULL OR EXISTS (SELECT 1 FROM orden_mecanico om WHERE om.orden_id = o.id
                 AND om.mecanico_id = :mecanicoId))
            AND (:servicioId IS NULL OR EXISTS (SELECT 1 FROM orden_servicio fs WHERE fs.orden_id = o.id
                 AND fs.servicio_id = :servicioId))""";

    private final NamedParameterJdbcTemplate jdbc;

    public EstadisticasTallerRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Órdenes realizadas en el rango con sus sumas; con {@code servicioId}, solo cuenta ese servicio. */
    public List<FilaOrden> ordenesRealizadas(Instant inicio, Instant fin, Long servicioId, Long mecanicoId) {
        String delServicio = " AND (:servicioId IS NULL OR s.servicio_id = :servicioId)";
        return jdbc.query("""
                SELECT o.id, o.numero, o.fecha_finalizacion, m.placa,
                       COALESCE(c.razon_social, CONCAT_WS(' ', c.nombres, c.apellidos)) AS cliente,
                       (SELECT COUNT(*) FROM orden_servicio s WHERE s.orden_id = o.id%1$s) AS servicios,
                       (SELECT COALESCE(SUM(s.precio), 0) FROM orden_servicio s WHERE s.orden_id = o.id%1$s) AS mano_obra,
                       (SELECT COALESCE(SUM(r.cantidad * r.precio_unitario), 0) FROM orden_repuesto r
                         WHERE r.orden_id = o.id) AS repuestos,
                       o.total, TIMESTAMPDIFF(MINUTE, o.fecha_ingreso, o.fecha_finalizacion) AS minutos,
                       (SELECT GROUP_CONCAT(u.nombre ORDER BY u.nombre SEPARATOR ', ') FROM orden_mecanico om
                         JOIN usuario u ON u.id = om.mecanico_id WHERE om.orden_id = o.id) AS mecanicos
                FROM orden_trabajo o
                JOIN motocicleta m ON m.id = o.motocicleta_id
                JOIN cliente c ON c.id = o.cliente_id
                WHERE %2$s
                ORDER BY o.fecha_finalizacion DESC, o.id DESC""".formatted(delServicio, REALIZADAS),
                parametros(inicio, fin, servicioId, mecanicoId),
                (rs, i) -> new FilaOrden(rs.getLong("id"), rs.getString("numero"),
                        FechasSql.leer(rs, "fecha_finalizacion"), rs.getString("placa"),
                        rs.getString("cliente"), rs.getLong("servicios"), rs.getBigDecimal("mano_obra"),
                        rs.getBigDecimal("repuestos"), rs.getBigDecimal("total"), rs.getLong("minutos"),
                        rs.getString("mecanicos")));
    }

    /** Servicios realizados agrupados por servicio del catálogo (o por descripción si es mano de obra libre). */
    public List<FilaServicio> serviciosRealizados(Instant inicio, Instant fin, Long servicioId, Long mecanicoId,
            int limite) {
        return jdbc.query("""
                SELECT COALESCE(sv.nombre, s.descripcion) AS nombre, COUNT(*) AS cantidad, SUM(s.precio) AS ingresos
                FROM orden_servicio s
                JOIN orden_trabajo o ON o.id = s.orden_id
                LEFT JOIN servicio sv ON sv.id = s.servicio_id
                WHERE %s AND (:servicioId IS NULL OR s.servicio_id = :servicioId)
                GROUP BY COALESCE(sv.nombre, s.descripcion)
                ORDER BY cantidad DESC, ingresos DESC
                LIMIT :limite""".formatted(REALIZADAS),
                parametros(inicio, fin, servicioId, mecanicoId).addValue("limite", limite),
                (rs, i) -> new FilaServicio(rs.getString("nombre"), rs.getLong("cantidad"),
                        rs.getBigDecimal("ingresos")));
    }

    /** Total de las órdenes entregadas en el rango (ingresos del taller por fecha de entrega). */
    public BigDecimal totalEntregadas(Instant inicio, Instant fin) {
        return jdbc.queryForObject("""
                SELECT COALESCE(SUM(o.total), 0) FROM orden_trabajo o
                WHERE o.estado = 'ENTREGADA' AND o.fecha_entrega >= :inicio AND o.fecha_entrega < :fin""",
                rango(inicio, fin), BigDecimal.class);
    }

    /** RN-53: ingresos de órdenes entregadas por día de Bogotá. */
    public Map<LocalDate, BigDecimal> entregadasPorDia(Instant inicio, Instant fin) {
        String dia = TiempoConfig.diaNegocioSql("o.fecha_entrega");
        return jdbc.query("""
                SELECT %1$s AS dia, SUM(o.total) AS total FROM orden_trabajo o
                WHERE o.estado = 'ENTREGADA' AND o.fecha_entrega >= :inicio AND o.fecha_entrega < :fin
                GROUP BY %1$s""".formatted(dia), rango(inicio, fin),
                (rs, i) -> Map.entry(rs.getDate("dia").toLocalDate(), rs.getBigDecimal("total"))).stream()
                .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
    }

    /** Órdenes del mecánico finalizadas en el rango (vista propia del dashboard). */
    public long finalizadasDelMecanico(Long mecanicoId, Instant inicio, Instant fin) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM orden_trabajo o WHERE " + REALIZADAS,
                parametros(inicio, fin, null, mecanicoId), Long.class);
    }

    private static MapSqlParameterSource rango(Instant inicio, Instant fin) {
        return new MapSqlParameterSource().addValue("inicio", FechasSql.parametro(inicio))
                .addValue("fin", FechasSql.parametro(fin));
    }

    private static MapSqlParameterSource parametros(Instant inicio, Instant fin, Long servicioId, Long mecanicoId) {
        return rango(inicio, fin).addValue("servicioId", servicioId).addValue("mecanicoId", mecanicoId);
    }

    public record FilaOrden(Long id, String numero, Instant fechaFinalizacion, String placa, String cliente,
            long servicios, BigDecimal manoObra, BigDecimal repuestos, BigDecimal total, long minutos,
            String mecanicos) {
    }

    public record FilaServicio(String nombre, long cantidad, BigDecimal ingresos) {
    }
}

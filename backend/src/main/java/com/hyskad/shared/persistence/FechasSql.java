package com.hyskad.shared.persistence;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;

/**
 * Fechas UTC (RN-53) en consultas JDBC directas. Hibernate ya trabaja en UTC, pero JDBC convierte
 * {@code Timestamp} con la zona de la JVM; con {@code LocalDateTime} en UTC el valor llega igual.
 */
public final class FechasSql {

    private FechasSql() {
    }

    public static LocalDateTime parametro(Instant instante) {
        return LocalDateTime.ofInstant(instante, ZoneOffset.UTC);
    }

    public static Instant leer(ResultSet rs, String columna) throws SQLException {
        LocalDateTime valor = rs.getObject(columna, LocalDateTime.class);
        return valor == null ? null : valor.toInstant(ZoneOffset.UTC);
    }
}

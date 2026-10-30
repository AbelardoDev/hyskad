package com.hyskad;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import com.hyskad.support.IntegrationTest;

/** Flyway aplica las migraciones sobre MySQL vacío y Hibernate valida el esquema (ddl-auto=validate). */
@IntegrationTest
class HyskadApplicationTests {

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    void migracionesAplicadasYEsquemaValido() {
        Integer fallidas = jdbc.queryForObject(
                "select count(*) from flyway_schema_history where success = false", Integer.class);
        String version = jdbc.queryForObject(
                "select max(version) from flyway_schema_history where success = true", String.class);

        assertThat(fallidas).isZero();
        assertThat(version).isEqualTo("1");
        assertThat(jdbc.queryForList("select tipo from consecutivo order by tipo", String.class))
                .containsExactly("COMPRA", "OT", "PRESUPUESTO", "VENTA");
    }
}

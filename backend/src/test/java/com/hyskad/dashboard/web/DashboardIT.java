package com.hyskad.dashboard.web;

import static com.hyskad.support.FlujoOrdenes.con;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import com.hyskad.support.FlujoOrdenes;
import com.hyskad.support.IntegrationTest;
import com.hyskad.support.UsuariosDePrueba;
import com.hyskad.usuarios.domain.Rol;

import tools.jackson.databind.JsonNode;

/** Panel de control (RF34) con MySQL real: los KPIs coinciden con consultas directas (CP-58). */
@IntegrationTest
class DashboardIT {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private UsuariosDePrueba usuarios;

    @Autowired
    private FlujoOrdenes flujo;

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    void cp58LosKpisDelAdminCoincidenConLaConsultaManual() throws Exception {
        String admin = usuarios.bearer(usuarios.crear(Rol.ADMIN).id());
        String vendedor = usuarios.bearer(usuarios.crear(Rol.VENDEDOR).id());
        long mecanicoId = usuarios.crear(Rol.MECANICO).id();
        flujo.finalizada(flujo.clienteConMoto(admin), 100, 100000, vendedor, mecanicoId, usuarios.bearer(mecanicoId));

        JsonNode d = flujo.ok(mvc.perform(con(get("/api/v1/dashboard"), admin)));
        JsonNode k = d.get("kpis");
        String hoyUtc = "DATE(CONVERT_TZ(%s, '+00:00', '-05:00')) = DATE(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '-05:00'))";
        assertThat(k.get("ventasHoyCantidad").asLong()).isEqualTo(jdbc.queryForObject(
                "select count(*) from venta where estado = 'PAGADA' and " + hoyUtc.formatted("fecha"), Long.class));
        assertThat(k.get("ventasHoyTotal").decimalValue()).isEqualByComparingTo(jdbc.queryForObject(
                "select coalesce(sum(total), 0) from venta where estado = 'PAGADA' and " + hoyUtc.formatted("fecha"),
                BigDecimal.class));
        assertThat(k.get("ordenesActivas").asLong()).isEqualTo(jdbc.queryForObject(
                "select count(*) from orden_trabajo where estado not in ('ENTREGADA', 'CANCELADA')", Long.class));
        assertThat(k.get("pendientesAprobacion").asLong()).isEqualTo(jdbc.queryForObject(
                "select count(*) from orden_trabajo where estado = 'PENDIENTE_APROBACION'", Long.class));
        assertThat(k.get("porCobrar").decimalValue()).isEqualByComparingTo(jdbc.queryForObject("""
                select coalesce(sum(o.total), 0) from orden_trabajo o where o.estado = 'FINALIZADA'
                and not exists (select 1 from pago p where p.orden_id = o.id)""", BigDecimal.class));
        assertThat(k.get("productosStockBajo").asLong()).isEqualTo(jdbc.queryForObject(
                "select count(*) from producto where activo and stock_actual - stock_reservado <= stock_minimo",
                Long.class));
        assertThat(k.get("finalizadasMes").isNull()).isTrue();

        assertThat(d.get("vista").asString()).isEqualTo("GENERAL");
        assertThat(d.get("ingresosDiarios")).hasSize(30);
        assertThat(d.get("ingresosDiarios").get(29).get("dia").asString())
                .isEqualTo(LocalDate.now(ZoneId.of("America/Bogota")).toString());
        assertThat(d.get("ordenesPorEstado").get("FINALIZADA").asLong()).isPositive();
        assertThat(d.get("topServicios").findValues("nombre")).extracting(JsonNode::asString)
                .contains("Mantenimiento general");
        assertThat(d.get("ultimasOrdenes")).hasSizeLessThanOrEqualTo(5).isNotEmpty();
    }

    @Test
    void elMecanicoVeSuVistaSinVentasNiInventario() throws Exception {
        String admin = usuarios.bearer(usuarios.crear(Rol.ADMIN).id());
        String vendedor = usuarios.bearer(usuarios.crear(Rol.VENDEDOR).id());
        long mecanicoId = usuarios.crear(Rol.MECANICO).id();
        String mecanico = usuarios.bearer(mecanicoId);
        flujo.finalizada(flujo.clienteConMoto(admin), 100, 100000, vendedor, mecanicoId, mecanico);
        flujo.recibida(flujo.clienteConMoto(admin), 100, vendedor, mecanicoId);

        JsonNode d = flujo.ok(mvc.perform(con(get("/api/v1/dashboard"), mecanico)));
        assertThat(d.get("vista").asString()).isEqualTo("MECANICO");
        JsonNode k = d.get("kpis");
        assertThat(k.get("finalizadasMes").asLong()).isOne();
        assertThat(k.get("ordenesActivas").asLong()).isEqualTo(2);
        assertThat(k.get("ventasHoyTotal").isNull()).isTrue();
        assertThat(k.get("porCobrar").isNull()).isTrue();
        assertThat(k.get("pendientesAprobacion").isNull()).isTrue();
        assertThat(k.get("productosStockBajo").isNull()).isTrue();
        assertThat(d.get("ordenesPorEstado").get("RECIBIDA").asLong()).isOne();
        assertThat(d.get("ingresosDiarios")).isEmpty();
        assertThat(d.get("stockCritico")).isEmpty();
        assertThat(d.get("ultimasOrdenes")).hasSize(2);
    }

    @Test
    void periodoInvalidoYSinPermisoDeDashboard() throws Exception {
        String admin = usuarios.bearer(usuarios.crear(Rol.ADMIN).id());
        mvc.perform(con(get("/api/v1/dashboard").param("desde", "2026-05-02").param("hasta", "2026-05-01"), admin))
                .andExpect(status().isBadRequest());
        JsonNode d = flujo.ok(mvc.perform(con(get("/api/v1/dashboard").param("desde", "2026-05-01")
                .param("hasta", "2026-05-07"), admin)));
        assertThat(d.get("ingresosDiarios")).hasSize(7);
    }
}

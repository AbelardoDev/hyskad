package com.hyskad.reportes.web;

import static com.hyskad.support.FlujoOrdenes.con;
import static com.hyskad.support.FlujoOrdenes.id;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;
import java.time.ZoneId;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import com.hyskad.support.FlujoOrdenes;
import com.hyskad.support.FlujoOrdenes.ClienteMoto;
import com.hyskad.support.IntegrationTest;
import com.hyskad.support.UsuariosDePrueba;
import com.hyskad.usuarios.domain.Rol;

import tools.jackson.databind.JsonNode;

/** RF26 y RN-37: cuentas pendientes con MySQL real (CP-49). */
@IntegrationTest
class CuentasPendientesIT {

    private static final String RUTA = "/api/v1/reportes/cuentas-pendientes";

    @Autowired
    private MockMvc mvc;

    @Autowired
    private UsuariosDePrueba usuarios;

    @Autowired
    private FlujoOrdenes flujo;

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    void cp49SoloFinalizadasSinPagoConDiasTranscurridosYTotalAdeudado() throws Exception {
        String admin = usuarios.bearer(usuarios.crear(Rol.ADMIN).id());
        String vendedor = usuarios.bearer(usuarios.crear(Rol.VENDEDOR).id());
        long mecanicoId = usuarios.crear(Rol.MECANICO).id();
        String mecanico = usuarios.bearer(mecanicoId);
        ClienteMoto a = flujo.clienteConMoto(admin);
        ClienteMoto b = flujo.clienteConMoto(admin);

        JsonNode antigua = flujo.finalizada(a, 100, 100000, vendedor, mecanicoId, mecanico); // 119.000
        jdbc.update("update orden_trabajo set fecha_finalizacion = date_sub(utc_timestamp(6), interval 10 day) "
                + "where id = ?", id(antigua));
        JsonNode entregada = flujo.entregada(flujo.clienteConMoto(admin), 100, 50000, vendedor, mecanicoId,
                mecanico);
        JsonNode reciente = flujo.finalizada(b, 100, 20000, vendedor, mecanicoId, mecanico); // 23.800
        JsonNode pagadaSinEntregar = flujo.pagarEnEfectivo(flujo.finalizada(flujo.clienteConMoto(admin), 100, 1000,
                vendedor, mecanicoId, mecanico), vendedor);

        JsonNode deA = consultar("?clienteId=" + a.clienteId(), vendedor);
        assertThat(deA.get("cuentas").get("totalElements").asLong()).isOne();
        JsonNode cuenta = deA.get("cuentas").get("content").get(0);
        assertThat(cuenta.get("ordenId").asLong()).isEqualTo(id(antigua));
        assertThat(cuenta.get("diasTranscurridos").asLong()).isBetween(9L, 10L);
        assertThat(cuenta.get("cliente").asString()).isEqualTo("Ana Pagos");
        assertThat(cuenta.get("placa").asString()).isNotBlank();
        assertThat(deA.get("totalAdeudado").decimalValue()).isEqualByComparingTo("119000");

        JsonNode todas = consultar("?size=200", admin);
        assertThat(todas.get("cuentas").get("content").findValues("ordenId")).extracting(JsonNode::asLong)
                .contains(id(antigua), id(reciente)).doesNotContain(id(pagadaSinEntregar), id(entregada));
        JsonNode deB = consultar("?clienteId=" + b.clienteId(), admin).get("cuentas").get("content").get(0);
        assertThat(deB.get("diasTranscurridos").asLong()).isZero();

        LocalDate hoy = LocalDate.now(ZoneId.of("America/Bogota"));
        JsonNode soloHoy = consultar("?clienteId=" + a.clienteId() + "&desde=" + hoy.minusDays(1) + "&hasta=" + hoy,
                admin);
        assertThat(soloHoy.get("cuentas").get("totalElements").asLong()).isZero();
        assertThat(soloHoy.get("totalAdeudado").decimalValue()).isEqualByComparingTo("0");

        mvc.perform(con(get(RUTA), mecanico)).andExpect(status().isForbidden());
    }

    private JsonNode consultar(String consulta, String bearer) throws Exception {
        return flujo.ok(mvc.perform(con(get(RUTA + consulta), bearer)));
    }
}

package com.hyskad.configuracion.web;

import static com.hyskad.support.FlujoOrdenes.con;
import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.time.Duration;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionTemplate;

import com.hyskad.inventario.domain.StockBajoDetectado;
import com.hyskad.support.FlujoOrdenes;
import com.hyskad.support.IntegrationTest;
import com.hyskad.support.UsuariosDePrueba;
import com.hyskad.usuarios.domain.Rol;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

/** Edición de la configuración del taller (F11) con auditoría (RN-51). Restaura los valores al final. */
@IntegrationTest
class ConfiguracionEdicionIT {

    private static final String BASE = "/api/v1/configuracion";

    @Autowired
    private MockMvc mvc;

    @Autowired
    private UsuariosDePrueba usuarios;

    @Autowired
    private FlujoOrdenes flujo;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private ObjectMapper json;

    @Autowired
    private ApplicationEventPublisher eventos;

    @Autowired
    private TransactionTemplate transaccion;

    private String admin;
    private JsonNode original;

    @BeforeEach
    void iniciar() throws Exception {
        admin = usuarios.bearer(usuarios.crear(Rol.ADMIN).id());
        original = flujo.ok(mvc.perform(con(get(BASE), admin)));
    }

    @AfterEach
    void restaurar() throws Exception {
        mvc.perform(con(put(BASE), admin).content(json.writeValueAsString(original))).andExpect(status().isOk());
    }

    @Test
    void elAdminEditaLaConfiguracionYQuedaAuditada() throws Exception {
        assertThat(original.get("nombre").asString()).isEqualTo("Taller HYSKAD");
        assertThat(original.get("textoAutorizacionDatos").asString()).contains("Ley 1581 de 2012");

        JsonNode guardada = flujo.ok(mvc.perform(con(put(BASE), admin).content("""
                {"nombre":"Motos del Sinú","nit":"9001234568","direccion":"Cra 3 # 20-15, Montería",
                 "telefono":"300 123 4567","email":"Taller@Sinu.test","ivaPorcentaje":19,
                 "textoAutorizacionDatos":"Autorizo el uso de mis datos.","alertaStockHabilitada":false}""")));
        assertThat(guardada.get("nit").asString()).isEqualTo("900123456-8");
        assertThat(guardada.get("telefono").asString()).isEqualTo("3001234567");
        assertThat(guardada.get("email").asString()).isEqualTo("taller@sinu.test");

        mvc.perform(con(get(BASE + "/autorizacion-datos"), usuarios.bearer(usuarios.crear(Rol.MECANICO).id())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.texto").value("Autorizo el uso de mis datos."));
        String detalle = jdbc.queryForObject("select detalle from auditoria where accion = "
                + "'CONFIGURACION_ACTUALIZADA' order by id desc limit 1", String.class);
        assertThat(detalle).contains("taller.nombre", "taller.direccion", "stock.alerta.habilitada")
                .doesNotContain("iva.porcentaje");
    }

    @Test
    void cambiarElIvaAuditaElAnteriorYAplicaEnLasLecturas() throws Exception {
        String cuerpo = json.writeValueAsString(original).replaceAll("\"ivaPorcentaje\":[0-9.]+",
                "\"ivaPorcentaje\":16");
        mvc.perform(con(put(BASE), admin).content(cuerpo)).andExpect(status().isOk());
        mvc.perform(con(get(BASE + "/iva"), admin)).andExpect(jsonPath("$.porcentaje").value(16));
        String detalle = jdbc.queryForObject("select detalle from auditoria where accion = "
                + "'CONFIGURACION_ACTUALIZADA' order by id desc limit 1", String.class);
        assertThat(detalle).contains("\"ivaAnterior\": \"19\"", "\"ivaNuevo\": \"16\"");
    }

    @Test
    void validaElNitYSoloLaEditaQuienTienePermiso() throws Exception {
        String cuerpo = json.writeValueAsString(original).replace(original.get("nit").asString(), "900123456-1");
        mvc.perform(con(put(BASE), admin).content(cuerpo))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].campo").value("nit"))
                .andExpect(jsonPath("$.errors[0].code").value("NIT_INVALIDO"));
        String vendedor = usuarios.bearer(usuarios.crear(Rol.VENDEDOR).id());
        mvc.perform(con(get(BASE), vendedor)).andExpect(status().isForbidden());
        mvc.perform(con(put(BASE), vendedor).content(json.writeValueAsString(original)))
                .andExpect(status().isForbidden());
    }

    // CP-136
    @Test
    void conLaAlertaDeStockApagadaNoSeNotificaElStockBajo() throws Exception {
        Long almacen = usuarios.crear(Rol.ALMACEN).id();
        ObjectNode apagada = ((ObjectNode) original.deepCopy()).put("alertaStockHabilitada", false);
        mvc.perform(con(put(BASE), admin).content(json.writeValueAsString(apagada)))
                .andExpect(jsonPath("$.alertaStockHabilitada").value(false));
        publicarStockBajo("ALERTA-OFF");

        ObjectNode encendida = ((ObjectNode) original.deepCopy()).put("alertaStockHabilitada", true);
        mvc.perform(con(put(BASE), admin).content(json.writeValueAsString(encendida))).andExpect(status().isOk());
        publicarStockBajo("ALERTA-ON");

        await().atMost(Duration.ofSeconds(5)).until(() -> avisosStockBajo(almacen, "ALERTA-ON") == 1);
        assertThat(avisosStockBajo(almacen, "ALERTA-OFF")).isZero();
    }

    private void publicarStockBajo(String codigo) {
        transaccion.executeWithoutResult(estado -> eventos.publishEvent(
                new StockBajoDetectado(-1L, codigo, "Producto " + codigo, BigDecimal.ONE, BigDecimal.TEN)));
    }

    private int avisosStockBajo(Long usuarioId, String codigo) {
        return jdbc.queryForObject("select count(*) from notificacion where usuario_id = ? and tipo = 'STOCK_BAJO'"
                + " and parametros->>'$.codigo' = ?", Integer.class, usuarioId, codigo);
    }
}

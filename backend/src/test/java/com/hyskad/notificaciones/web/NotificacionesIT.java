package com.hyskad.notificaciones.web;

import static com.hyskad.support.FlujoOrdenes.con;
import static com.hyskad.support.FlujoOrdenes.id;
import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.time.Duration;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.support.TransactionTemplate;

import com.hyskad.notificaciones.application.StreamNotificaciones;
import com.hyskad.support.FlujoOrdenes;
import com.hyskad.support.FlujoOrdenes.ClienteMoto;
import com.hyskad.support.IntegrationTest;
import com.hyskad.support.UsuariosDePrueba;
import com.hyskad.usuarios.domain.Rol;
import com.hyskad.ventas.domain.VentaAnulada;

import tools.jackson.databind.JsonNode;

/** Notificaciones internas y su stream SSE con MySQL real (RF30, IC5). */
@IntegrationTest
class NotificacionesIT {

    private static final String BASE = "/api/v1/notificaciones";
    private static final Duration ESPERA = Duration.ofSeconds(5);

    @Autowired
    private MockMvc mvc;

    @Autowired
    private UsuariosDePrueba usuarios;

    @Autowired
    private FlujoOrdenes flujo;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private ApplicationEventPublisher eventos;

    @Autowired
    private TransactionTemplate transaccion;

    @Autowired
    private StreamNotificaciones stream;

    private String admin;
    private Long vendedorId;
    private String vendedor;
    private Long mecanicoId;
    private String mecanico;

    @BeforeEach
    void iniciar() {
        admin = usuarios.bearer(usuarios.crear(Rol.ADMIN).id());
        vendedorId = usuarios.crear(Rol.VENDEDOR).id();
        vendedor = usuarios.bearer(vendedorId);
        mecanicoId = usuarios.crear(Rol.MECANICO).id();
        mecanico = usuarios.bearer(mecanicoId);
    }

    @Test
    void cp52ElCambioDeEstadoLlegaPorSseAlCreadorEnMenosDeDosSegundos() throws Exception {
        ClienteMoto cm = flujo.clienteConMoto(admin);
        JsonNode orden = flujo.recibida(cm, 100, vendedor, mecanicoId);
        MvcResult conexion = mvc.perform(get(BASE + "/stream").param("ticket", ticket(vendedor)))
                .andExpect(request().asyncStarted()).andReturn();
        assertThat(conexion.getResponse().getContentType()).startsWith("text/event-stream");

        flujo.transicion(orden, "EN_DIAGNOSTICO", null, mecanico);

        await().atMost(Duration.ofSeconds(2)).untilAsserted(() -> assertThat(conexion.getResponse()
                .getContentAsString()).contains("event:notificacion").contains("ESTADO_ORDEN_CAMBIADO")
                .contains(orden.get("numero").asString()).contains("EN_DIAGNOSTICO"));
        // Quien hizo la acción no se notifica a sí mismo
        assertThat(cuantas(mecanicoId, "ESTADO_ORDEN_CAMBIADO")).isZero();
        assertThat(cuantas(mecanicoId, "MECANICO_ASIGNADO")).isOne();
    }

    @Test
    void elTicketEsDeUnSoloUsoYSinTicketValidoNoHayStream() throws Exception {
        String ticket = ticket(vendedor);
        mvc.perform(get(BASE + "/stream").param("ticket", ticket)).andExpect(request().asyncStarted());
        mvc.perform(get(BASE + "/stream").param("ticket", ticket)).andExpect(status().isUnauthorized());
        mvc.perform(get(BASE + "/stream").param("ticket", "inventado")).andExpect(status().isUnauthorized());
        mvc.perform(get(BASE + "/stream")).andExpect(status().isUnauthorized());
        mvc.perform(post(BASE + "/stream-ticket")).andExpect(status().isUnauthorized());
    }

    @Test
    void unEventoDeUnaTransaccionRevertidaNoNotifica() throws Exception {
        Long adminId = usuarios.crear(Rol.ADMIN).id();
        VentaAnulada revertida = new VentaAnulada(-1L, "V-REVERTIDA", BigDecimal.TEN, null);
        transaccion.executeWithoutResult(estado -> {
            eventos.publishEvent(revertida);
            estado.setRollbackOnly();
        });
        VentaAnulada confirmada = new VentaAnulada(-2L, "V-CONFIRMADA", BigDecimal.TEN, null);
        transaccion.executeWithoutResult(estado -> eventos.publishEvent(confirmada));

        await().atMost(ESPERA).until(() -> conParametro(adminId, "V-CONFIRMADA") == 1);
        assertThat(conParametro(adminId, "V-REVERTIDA")).isZero();
    }

    @Test
    void cadaUsuarioVeYMarcaSoloLasSuyas() throws Exception {
        ClienteMoto cm = flujo.clienteConMoto(admin);
        flujo.recibida(cm, 100, vendedor, mecanicoId);
        await().atMost(ESPERA).until(() -> cuantas(mecanicoId, "MECANICO_ASIGNADO") == 1);

        JsonNode pagina = flujo.ok(mvc.perform(con(get(BASE), mecanico)));
        JsonNode propia = pagina.get("content").get(0);
        assertThat(propia.get("tipo").asString()).isEqualTo("MECANICO_ASIGNADO");
        assertThat(propia.get("tituloClave").asString()).isEqualTo("notificaciones.tipos.MECANICO_ASIGNADO.titulo");
        assertThat(propia.get("parametros").get("placa").asString()).isNotBlank();
        assertThat(propia.get("enlace").asString()).startsWith("/ordenes/");
        long notificacion = propia.get("id").asLong();

        String otro = usuarios.bearer(usuarios.crear(Rol.MECANICO).id());
        mvc.perform(con(patch(BASE + "/" + notificacion + "/leida"), otro)).andExpect(status().isNotFound());
        mvc.perform(con(get(BASE), otro)).andExpect(jsonPath("$.totalElements").value(0));

        mvc.perform(con(get(BASE + "/conteo-no-leidas"), mecanico)).andExpect(jsonPath("$.noLeidas").value(1));
        mvc.perform(con(patch(BASE + "/" + notificacion + "/leida"), mecanico))
                .andExpect(status().isOk()).andExpect(jsonPath("$.leida").value(true));
        mvc.perform(con(get(BASE).param("soloNoLeidas", "true"), mecanico))
                .andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(con(patch(BASE + "/leidas"), mecanico)).andExpect(jsonPath("$.marcadas").value(0));
    }

    @Test
    void laOrdenCreadaNotificaAVendedoresYAdminsMenosAQuienLaRecibio() throws Exception {
        Long otroVendedor = usuarios.crear(Rol.VENDEDOR).id();
        Long otroAdmin = usuarios.crear(Rol.ADMIN).id();
        Long inactivo = usuarios.crear(Rol.VENDEDOR, false, "es").id();
        JsonNode orden = flujo.recibida(flujo.clienteConMoto(admin), 100, vendedor, mecanicoId);

        await().atMost(ESPERA).until(() -> cuantas(otroVendedor, "ORDEN_CREADA") == 1
                && cuantas(otroAdmin, "ORDEN_CREADA") == 1);
        assertThat(cuantas(vendedorId, "ORDEN_CREADA")).isZero();
        assertThat(cuantas(inactivo, "ORDEN_CREADA")).isZero();
        assertThat(jdbc.queryForObject("select enlace from notificacion where usuario_id = ? and tipo = 'ORDEN_CREADA'",
                String.class, otroVendedor)).isEqualTo("/ordenes/" + id(orden));
    }

    @Test
    void desactivarAlUsuarioCierraSusConexiones() throws Exception {
        Creado creado = new Creado(usuarios.crear(Rol.VENDEDOR).id());
        String bearer = usuarios.bearer(creado.id());
        mvc.perform(get(BASE + "/stream").param("ticket", ticket(bearer))).andExpect(request().asyncStarted());
        mvc.perform(get(BASE + "/stream").param("ticket", ticket(bearer))).andExpect(request().asyncStarted());
        assertThat(stream.conexiones(creado.id())).isEqualTo(2);

        mvc.perform(con(patch("/api/v1/usuarios/" + creado.id() + "/estado"), admin).content("{\"activo\":false}"))
                .andExpect(status().isOk());
        await().atMost(ESPERA).until(() -> stream.conexiones(creado.id()) == 0);
    }

    private String ticket(String bearer) throws Exception {
        return flujo.ok(mvc.perform(con(post(BASE + "/stream-ticket"), bearer))).get("ticket").asString();
    }

    private int cuantas(Long usuarioId, String tipo) {
        return jdbc.queryForObject("select count(*) from notificacion where usuario_id = ? and tipo = ?",
                Integer.class, usuarioId, tipo);
    }

    private int conParametro(Long usuarioId, String numero) {
        return jdbc.queryForObject("select count(*) from notificacion where usuario_id = ? and "
                + "parametros->>'$.numero' = ?", Integer.class, usuarioId, numero);
    }

    private record Creado(Long id) {
    }
}

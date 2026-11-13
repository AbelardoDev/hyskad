package com.hyskad.taller.web;

import static com.hyskad.support.FlujoOrdenes.BASE;
import static com.hyskad.support.FlujoOrdenes.con;
import static com.hyskad.support.FlujoOrdenes.id;
import static com.hyskad.support.FlujoOrdenes.version;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.event.ApplicationEvents;
import org.springframework.test.context.event.RecordApplicationEvents;
import org.springframework.test.web.servlet.MockMvc;

import com.hyskad.support.FlujoOrdenes;
import com.hyskad.support.FlujoOrdenes.ClienteMoto;
import com.hyskad.support.IntegrationTest;
import com.hyskad.support.UsuariosDePrueba;
import com.hyskad.taller.domain.OrdenEntregada;
import com.hyskad.usuarios.domain.Rol;

import tools.jackson.databind.JsonNode;

/** Pago, entrega y comprobante de la orden con MySQL real (RF25, RF27, RF28; RN-35, RN-36). */
@IntegrationTest
@RecordApplicationEvents
class PagoEntregaIT {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private UsuariosDePrueba usuarios;

    @Autowired
    private FlujoOrdenes flujo;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private ApplicationEvents eventos;

    private String admin;
    private String vendedor;
    private long mecanicoId;
    private String mecanico;

    @BeforeEach
    void iniciar() {
        admin = usuarios.bearer(usuarios.crear(Rol.ADMIN).id());
        vendedor = usuarios.bearer(usuarios.crear(Rol.VENDEDOR).id());
        mecanicoId = usuarios.crear(Rol.MECANICO).id();
        mecanico = usuarios.bearer(mecanicoId);
    }

    @Test
    void cp47ElMontoDebeSerExactamenteElTotal() throws Exception {
        JsonNode orden = finalizada(100000); // total 119.000 con IVA 19 %
        for (String monto : List.of("118999", "119000.01", "0")) {
            flujo.pagar(orden, "{\"monto\":%s,\"metodo\":\"EFECTIVO\"}".formatted(monto), vendedor)
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("MONTO_INVALIDO"))
                    .andExpect(jsonPath("$.total").value(119000));
        }
        assertThat(flujo.obtener(orden, vendedor).get("pago").isNull()).isTrue();
    }

    @Test
    void pagarFueraDeFinalizadaOPorSegundaVezDa409() throws Exception {
        ClienteMoto cm = flujo.clienteConMoto(admin);
        JsonNode recibida = flujo.recibida(cm, 100, vendedor, mecanicoId);
        flujo.pagar(recibida, "{\"monto\":0,\"metodo\":\"EFECTIVO\"}", vendedor)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ORDEN_ESTADO_INVALIDO"));

        JsonNode orden = finalizada(50000);
        JsonNode pagada = flujo.pagarEnEfectivo(orden, vendedor);
        assertThat(pagada.get("pago").get("metodo").asString()).isEqualTo("EFECTIVO");
        flujo.pagar(orden, "{\"monto\":59500,\"metodo\":\"EFECTIVO\"}", vendedor)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PAGO_DUPLICADO"));
        assertThat(jdbc.queryForObject("select count(*) from pago where orden_id = ?", Integer.class, id(orden)))
                .isOne();
    }

    @Test
    void laReferenciaEsObligatoriaSalvoEnEfectivoYLoRecibidoCubreElTotal() throws Exception {
        JsonNode orden = finalizada(50000); // total 59.500
        flujo.pagar(orden, "{\"monto\":59500,\"metodo\":\"TRANSFERENCIA\",\"referencia\":\" \"}", vendedor)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].campo").value("referencia"))
                .andExpect(jsonPath("$.errors[0].code").value("REFERENCIA_REQUERIDA"));
        flujo.pagar(orden, "{\"monto\":59500,\"metodo\":\"EFECTIVO\",\"montoRecibido\":50000}", vendedor)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].code").value("MONTO_INSUFICIENTE"));

        JsonNode pagada = flujo.ok(flujo.pagar(orden,
                "{\"monto\":59500,\"metodo\":\"EFECTIVO\",\"montoRecibido\":60000,\"referencia\":\"ignorada\"}",
                vendedor));
        JsonNode pago = pagada.get("pago");
        assertThat(pago.get("cambio").decimalValue()).isEqualByComparingTo("500");
        assertThat(pago.get("referencia").isNull()).isTrue();
        assertThat(pago.get("usuario").get("nombre").asString()).isEqualTo("Prueba VENDEDOR");
        assertThat(pagada.get("accionesPermitidas").get("registrarPago").asBoolean()).isFalse();
        assertThat(pagada.get("accionesPermitidas").get("registrarEntrega").asBoolean()).isTrue();
        assertThat(jdbc.queryForObject("select count(*) from auditoria where accion = 'ORDEN_PAGO_REGISTRADO' "
                + "and entidad_id = ?", Integer.class, id(orden))).isOne();
    }

    @Test
    void cp48EntregarSinPagoDa409YLaTransicionGenericaNoEntrega() throws Exception {
        JsonNode orden = finalizada(30000);
        JsonNode acciones = flujo.obtener(orden, vendedor).get("accionesPermitidas");
        assertThat(acciones.get("registrarPago").asBoolean()).isTrue();
        assertThat(acciones.get("registrarEntrega").asBoolean()).isFalse();
        assertThat(acciones.get("transiciones").get(0).get("bloqueo").asString()).isEqualTo("SIN_PAGO");

        flujo.entregar(orden, null, vendedor)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PAGO_REQUERIDO"));
        flujo.pagarEnEfectivo(orden, vendedor);
        JsonNode pagada = flujo.obtener(orden, vendedor);
        mvc.perform(con(post(BASE + "/" + id(orden) + "/transiciones"), vendedor).content("""
                {"version":%d,"estado":"ENTREGADA"}""".formatted(version(pagada))))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.motivo").value("ENTREGA_REQUERIDA"));
        assertThat(flujo.obtener(orden, vendedor).get("estado").asString()).isEqualTo("FINALIZADA");
    }

    @Test
    void entregarCierraLaOrdenGuardaQuienYPublicaElEvento() throws Exception {
        JsonNode orden = flujo.pagarEnEfectivo(finalizada(80000), vendedor);
        JsonNode entregada = flujo.ok(flujo.entregar(orden, "Se entrega lavada", vendedor));

        assertThat(entregada.get("estado").asString()).isEqualTo("ENTREGADA");
        assertThat(entregada.get("entrega").get("observaciones").asString()).isEqualTo("Se entrega lavada");
        assertThat(entregada.get("entrega").get("usuario").get("nombre").asString()).isEqualTo("Prueba VENDEDOR");
        assertThat(entregada.get("entrega").get("fecha").isNull()).isFalse();
        JsonNode ultimo = entregada.get("historial").get(entregada.get("historial").size() - 1);
        assertThat(ultimo.get("estadoNuevo").asString()).isEqualTo("ENTREGADA");
        assertThat(entregada.get("accionesPermitidas").get("registrarEntrega").asBoolean()).isFalse();
        assertThat(eventos.stream(OrdenEntregada.class)).singleElement()
                .satisfies(e -> assertThat(e.ordenId()).isEqualTo(id(orden)));
        assertThat(jdbc.queryForList("select accion from auditoria where entidad = 'orden_trabajo' and entidad_id = ? "
                + "and accion in ('ORDEN_PAGO_REGISTRADO', 'ORDEN_ENTREGADA') order by id", String.class, id(orden)))
                .containsExactly("ORDEN_PAGO_REGISTRADO", "ORDEN_ENTREGADA");
        flujo.entregar(orden, null, vendedor).andExpect(status().isConflict());
    }

    @Test
    void elMecanicoNoCobraNiEntregaPeroVeElComprobanteDeSuOrden() throws Exception {
        JsonNode orden = finalizada(40000);
        flujo.pagar(orden, "{\"monto\":47600,\"metodo\":\"EFECTIVO\"}", mecanico).andExpect(status().isForbidden());
        flujo.entregar(orden, null, mecanico).andExpect(status().isForbidden());
        assertThat(flujo.obtener(orden, vendedor).get("accionesPermitidas").get("registrarPago").asBoolean())
                .isTrue();
        assertThat(flujo.obtener(orden, mecanico).get("accionesPermitidas").get("registrarPago").asBoolean())
                .isFalse();

        mvc.perform(con(get(BASE + "/" + id(orden) + "/comprobante"), vendedor))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PAGO_REQUERIDO"));
        flujo.pagarEnEfectivo(orden, vendedor);
        mvc.perform(con(get(BASE + "/" + id(orden) + "/comprobante"), mecanico))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.numero").value(orden.get("numero").asString()))
                .andExpect(jsonPath("$.taller.nombre").isString())
                .andExpect(jsonPath("$.moto.placa").isString())
                .andExpect(jsonPath("$.cliente.nombreCompleto").value("Ana Pagos"))
                .andExpect(jsonPath("$.kilometrajeIngreso").value(100))
                .andExpect(jsonPath("$.diagnostico").value("Cadena destensionada y bujía gastada"))
                .andExpect(jsonPath("$.mecanicos[0]").value("Prueba MECANICO"))
                .andExpect(jsonPath("$.servicios[0].descripcion").value("Mantenimiento general"))
                .andExpect(jsonPath("$.total").value(47600))
                .andExpect(jsonPath("$.pago.metodo").value("EFECTIVO"))
                .andExpect(jsonPath("$.leyenda").value("Documento interno. No es factura electrónica."))
                .andExpect(jsonPath("$.repuestos[0].costoUnitario").doesNotExist());
        String otro = usuarios.bearer(usuarios.crear(Rol.MECANICO).id());
        mvc.perform(con(get(BASE + "/" + id(orden) + "/comprobante"), otro)).andExpect(status().isNotFound());
    }

    private JsonNode finalizada(int precio) throws Exception {
        return flujo.finalizada(flujo.clienteConMoto(admin), 100, precio, vendedor, mecanicoId, mecanico);
    }
}

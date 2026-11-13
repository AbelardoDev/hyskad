package com.hyskad.motocicletas.web;

import static com.hyskad.support.FlujoOrdenes.con;
import static com.hyskad.support.FlujoOrdenes.id;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;

import com.hyskad.support.FlujoOrdenes;
import com.hyskad.support.FlujoOrdenes.ClienteMoto;
import com.hyskad.support.IntegrationTest;
import com.hyskad.support.UsuariosDePrueba;
import com.hyskad.usuarios.domain.Rol;

import tools.jackson.databind.JsonNode;

/** RF9: historial de la moto con sus órdenes reales (CP-21). */
@IntegrationTest
class HistorialMotocicletaIT {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private UsuariosDePrueba usuarios;

    @Autowired
    private FlujoOrdenes flujo;

    @Test
    void cp21HistorialOrdenadoPorFechaSinCanceladasSalvoQueSePidan() throws Exception {
        String admin = usuarios.bearer(usuarios.crear(Rol.ADMIN).id());
        String vendedor = usuarios.bearer(usuarios.crear(Rol.VENDEDOR).id());
        long mecanicoId = usuarios.crear(Rol.MECANICO).id();
        String mecanico = usuarios.bearer(mecanicoId);
        ClienteMoto cm = flujo.clienteConMoto(admin);

        JsonNode primera = flujo.entregada(cm, 1000, 50000, vendedor, mecanicoId, mecanico);
        JsonNode cancelada = flujo.transicion(flujo.recibida(cm, 1500, vendedor, mecanicoId), "CANCELADA",
                "El cliente desistió", vendedor);
        JsonNode segunda = flujo.entregada(cm, 2000, 70000, vendedor, mecanicoId, mecanico);
        JsonNode tercera = flujo.finalizada(cm, 3000, 90000, vendedor, mecanicoId, mecanico);

        JsonNode historial = historial(cm, vendedor, "");
        assertThat(historial.get("totalElements").asLong()).isEqualTo(3);
        JsonNode contenido = historial.get("content");
        assertThat(contenido.findValues("ordenId")).extracting(JsonNode::asLong)
                .containsExactly(id(tercera), id(segunda), id(primera));
        JsonNode reciente = contenido.get(0);
        assertThat(reciente.get("estado").asString()).isEqualTo("FINALIZADA");
        assertThat(reciente.get("kilometrajeIngreso").asInt()).isEqualTo(3000);
        assertThat(reciente.get("diagnostico").asString()).isEqualTo("Cadena destensionada y bujía gastada");
        assertThat(reciente.get("servicios").get(0).get("descripcion").asString()).isEqualTo("Mantenimiento general");
        assertThat(reciente.get("repuestos")).isEmpty();
        assertThat(reciente.get("total").decimalValue()).isEqualByComparingTo("107100");
        assertThat(reciente.get("mecanicos").get(0).asString()).isEqualTo("Prueba MECANICO");
        assertThat(contenido.get(1).get("fechaEntrega").isNull()).isFalse();

        JsonNode todas = historial(cm, vendedor, "?incluirCanceladas=true");
        assertThat(todas.get("totalElements").asLong()).isEqualTo(4);
        assertThat(todas.get("content").get(2).get("ordenId").asLong()).isEqualTo(id(cancelada));
        assertThat(todas.get("content").get(2).get("estado").asString()).isEqualTo("CANCELADA");

        JsonNode pagina = historial(cm, mecanico, "?size=2&page=1&sort=numero,asc");
        assertThat(pagina.get("totalPages").asInt()).isEqualTo(2);
        assertThat(pagina.get("content").get(0).get("ordenId").asLong()).isEqualTo(id(primera));
    }

    private JsonNode historial(ClienteMoto cm, String bearer, String consulta) throws Exception {
        return flujo.ok(mvc.perform(con(get("/api/v1/motocicletas/" + cm.motocicletaId() + "/historial" + consulta),
                bearer)));
    }
}

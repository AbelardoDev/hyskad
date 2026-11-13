package com.hyskad.busqueda.web;

import static com.hyskad.support.FlujoOrdenes.con;
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

/** Búsqueda global de la paleta (CP-20 en F11): tipos según permisos y órdenes según visibilidad. */
@IntegrationTest
class BusquedaIT {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private UsuariosDePrueba usuarios;

    @Autowired
    private FlujoOrdenes flujo;

    @Test
    void cp20BuscaPorPlacaYNumeroRespetandoPermisosYVisibilidad() throws Exception {
        String admin = usuarios.bearer(usuarios.crear(Rol.ADMIN).id());
        String vendedor = usuarios.bearer(usuarios.crear(Rol.VENDEDOR).id());
        long mecanicoId = usuarios.crear(Rol.MECANICO).id();
        ClienteMoto cm = flujo.clienteConMoto(admin);
        JsonNode orden = flujo.recibida(cm, 100, vendedor, mecanicoId);
        String placa = orden.get("motocicleta").get("placa").asString();
        String numero = orden.get("numero").asString();

        JsonNode porPlaca = buscar(vendedor, placa.substring(0, 3) + "-" + placa.substring(3));
        assertThat(porPlaca.get("motocicletas").findValues("titulo")).extracting(JsonNode::asString).contains(placa);
        assertThat(porPlaca.get("ordenes").findValues("titulo")).extracting(JsonNode::asString).contains(numero);
        assertThat(porPlaca.get("motocicletas").get(0).get("detalle").asString()).contains("Suzuki GN 125");

        // El mecánico encuentra su orden, pero no la de otro mecánico
        assertThat(buscar(usuarios.bearer(mecanicoId), numero).get("ordenes")).hasSize(1);
        String otro = usuarios.bearer(usuarios.crear(Rol.MECANICO).id());
        assertThat(buscar(otro, numero).get("ordenes")).isEmpty();

        // Almacén no ve clientes, motos ni órdenes de clientes... pero sí productos
        String almacen = usuarios.bearer(usuarios.crear(Rol.ALMACEN).id());
        JsonNode deAlmacen = buscar(almacen, "Ana");
        assertThat(deAlmacen.get("clientes")).isEmpty();
        assertThat(deAlmacen.get("motocicletas")).isEmpty();

        JsonNode clientes = buscar(vendedor, "Ana Pagos");
        assertThat(clientes.get("clientes")).isNotEmpty().hasSizeLessThanOrEqualTo(5);
        JsonNode corta = buscar(vendedor, "A");
        assertThat(corta.get("clientes")).isEmpty();
        assertThat(corta.get("ordenes")).isEmpty();
    }

    private JsonNode buscar(String bearer, String q) throws Exception {
        return flujo.ok(mvc.perform(con(get("/api/v1/busqueda"), bearer).param("q", q)));
    }
}

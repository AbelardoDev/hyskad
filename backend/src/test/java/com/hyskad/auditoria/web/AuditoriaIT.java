package com.hyskad.auditoria.web;

import static com.hyskad.support.FlujoOrdenes.con;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;

import com.hyskad.catalogo.domain.Producto;
import com.hyskad.inventario.application.InventarioService;
import com.hyskad.inventario.domain.Referencia;
import com.hyskad.support.CatalogoDePrueba;
import com.hyskad.support.FlujoOrdenes;
import com.hyskad.support.IntegrationTest;
import com.hyskad.support.UsuariosDePrueba;
import com.hyskad.usuarios.domain.Rol;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/** Consulta de auditoría (RF31, RN-51) con MySQL real. */
@IntegrationTest
class AuditoriaIT {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private UsuariosDePrueba usuarios;

    @Autowired
    private CatalogoDePrueba catalogo;

    @Autowired
    private InventarioService inventario;

    @Autowired
    private FlujoOrdenes flujo;

    @Autowired
    private ObjectMapper json;

    @Test
    void cp55LaAnulacionDeUnaVentaQuedaConUsuarioAccionEntidadIpYFecha() throws Exception {
        UsuariosDePrueba.Creado admin = usuarios.crear(Rol.ADMIN);
        String bearer = usuarios.bearer(admin.id());
        Producto p = catalogo.producto("0");
        inventario.registrarEntradaCompra(p.getId(), new BigDecimal("5"), new BigDecimal("1000"),
                new Referencia(Referencia.TipoReferencia.COMPRA, 1L, "C-1"));
        long venta = json.readTree(mvc.perform(con(post("/api/v1/ventas"), bearer).content("""
                {"items":[{"productoId":%d,"cantidad":1}],"descuento":0,"metodoPago":"EFECTIVO"}"""
                .formatted(p.getId()))).andExpect(status().isCreated()).andReturn().getResponse()
                .getContentAsString()).get("id").asLong();
        mvc.perform(con(post("/api/v1/ventas/" + venta + "/anulacion"), bearer)
                .content("{\"motivo\":\"Error de digitación\"}").with(r -> {
                    r.setRemoteAddr("10.20.30.40");
                    return r;
                })).andExpect(status().isOk());

        JsonNode historia = flujo.ok(mvc.perform(con(get("/api/v1/auditoria/entidad/venta/" + venta), bearer)));
        assertThat(historia.get("content").findValues("accion")).extracting(JsonNode::asString)
                .containsExactly("VENTA_ANULADA", "VENTA_REGISTRADA");
        JsonNode anulacion = historia.get("content").get(0);
        assertThat(anulacion.get("usuario").get("id").asLong()).isEqualTo(admin.id());
        assertThat(anulacion.get("usuario").get("nombre").asString()).isEqualTo("Prueba ADMIN");
        assertThat(anulacion.get("entidad").asString()).isEqualTo("venta");
        assertThat(anulacion.get("entidadId").asLong()).isEqualTo(venta);
        assertThat(anulacion.get("ip").asString()).isEqualTo("10.20.30.40");
        assertThat(anulacion.get("fecha").isNull()).isFalse();
        assertThat(anulacion.get("detalle").get("motivo").asString()).isEqualTo("Error de digitación");
    }

    @Test
    void filtraPorUsuarioAccionYFechasYSoloConAuditoriaVer() throws Exception {
        UsuariosDePrueba.Creado admin = usuarios.crear(Rol.ADMIN);
        String bearer = usuarios.bearer(admin.id());
        UsuariosDePrueba.Creado nuevo = usuarios.crear(Rol.VENDEDOR);
        mvc.perform(con(org.springframework.test.web.servlet.request.MockMvcRequestBuilders
                .patch("/api/v1/usuarios/" + nuevo.id() + "/estado"), bearer).content("{\"activo\":false}"))
                .andExpect(status().isOk());
        String hoy = LocalDate.now(ZoneId.of("America/Bogota")).toString();

        mvc.perform(con(get("/api/v1/auditoria"), bearer).param("usuarioId", String.valueOf(admin.id()))
                .param("accion", "usuario_desactivado").param("desde", hoy).param("hasta", hoy))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.content[0].entidad").value("usuario"))
                .andExpect(jsonPath("$.content[0].entidadId").value(nuevo.id()));
        mvc.perform(con(get("/api/v1/auditoria"), bearer).param("usuarioId", String.valueOf(admin.id()))
                .param("hasta", LocalDate.now(ZoneId.of("America/Bogota")).minusDays(1).toString()))
                .andExpect(jsonPath("$.totalElements").value(0));

        String vendedor = usuarios.bearer(usuarios.crear(Rol.VENDEDOR).id());
        mvc.perform(con(get("/api/v1/auditoria"), vendedor)).andExpect(status().isForbidden());
        mvc.perform(con(get("/api/v1/auditoria/entidad/venta/1"), vendedor)).andExpect(status().isForbidden());
    }
}

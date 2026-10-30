package com.hyskad.inventario.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.hyskad.catalogo.domain.Producto;
import com.hyskad.inventario.application.InventarioService;
import com.hyskad.inventario.domain.Referencia;
import com.hyskad.support.CatalogoDePrueba;
import com.hyskad.support.IntegrationTest;
import com.hyskad.support.UsuariosDePrueba;
import com.hyskad.support.UsuariosDePrueba.Creado;
import com.hyskad.usuarios.domain.Rol;

@IntegrationTest
class InventarioControllerIT {

    private static final String AJUSTES = "/api/v1/inventario/ajustes";
    private static final String MOVIMIENTOS = "/api/v1/inventario/movimientos";

    @Autowired
    private MockMvc mvc;

    @Autowired
    private UsuariosDePrueba usuarios;

    @Autowired
    private CatalogoDePrueba catalogo;

    @Autowired
    private InventarioService inventario;

    private Creado almacen;
    private String bearerAlmacen;
    private Producto producto;

    @BeforeEach
    void iniciar() {
        almacen = usuarios.crear(Rol.ALMACEN);
        bearerAlmacen = usuarios.bearer(almacen.id());
        producto = catalogo.producto("2");
    }

    @Test
    void ajusteDeEntradaRegistraElMovimientoConElUsuarioYActualizaElStock() throws Exception {
        mvc.perform(comoAlmacen(post(AJUSTES)).content(ajuste("ENTRADA", "12.5", "8000", "Inventario inicial")))
                .andExpect(status().isCreated())
                .andExpect(header().string(HttpHeaders.LOCATION, startsWith("http://localhost" + MOVIMIENTOS)))
                .andExpect(jsonPath("$.tipo").value("ENTRADA_AJUSTE"))
                .andExpect(jsonPath("$.cantidad").value(12.5))
                .andExpect(jsonPath("$.costoUnitario").value(8000))
                .andExpect(jsonPath("$.stockResultante").value(12.5))
                .andExpect(jsonPath("$.producto.codigo").value(producto.getCodigo()))
                .andExpect(jsonPath("$.motivo").value("Inventario inicial"))
                .andExpect(jsonPath("$.usuario.id").value(almacen.id()))
                .andExpect(jsonPath("$.usuario.nombre").value("Prueba ALMACEN"));

        mvc.perform(comoAlmacen(get("/api/v1/productos/" + producto.getId())))
                .andExpect(jsonPath("$.stockActual").value(12.5))
                .andExpect(jsonPath("$.costoPromedio").value(8000));
    }

    @Test
    void cp24SalidaPorAjusteQueDejariaElStockBajoLoReservadoDa409() throws Exception {
        inventario.registrarEntradaCompra(producto.getId(), new BigDecimal("5"), new BigDecimal("1000"), null);
        inventario.reservar(producto.getId(), new BigDecimal("4"),
                new Referencia(Referencia.TipoReferencia.ORDEN_TRABAJO, 1L, "OT-1"));

        mvc.perform(comoAlmacen(post(AJUSTES)).content(ajuste("SALIDA", "2", null, "Unidades dañadas")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("STOCK_INSUFICIENTE"));
    }

    @Test
    void validaMotivoCantidadYPermiso() throws Exception {
        mvc.perform(comoAlmacen(post(AJUSTES)).content(ajuste("ENTRADA", "0", "-1", "corto")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[?(@.campo == 'motivo')].code").value("SIZE"))
                .andExpect(jsonPath("$.errors[?(@.campo == 'cantidad')].code").value("DECIMAL_MIN"))
                .andExpect(jsonPath("$.errors[?(@.campo == 'costoUnitario')].code").value("DECIMAL_MIN"));
        mvc.perform(comoAlmacen(post(AJUSTES)).content(ajuste("ENTRADA", "1", null, "          a")))
                .andExpect(status().isBadRequest());
        for (Rol rol : new Rol[] { Rol.VENDEDOR, Rol.MECANICO }) {
            mvc.perform(post(AJUSTES).contentType(MediaType.APPLICATION_JSON)
                    .content(ajuste("ENTRADA", "1", null, "Conteo físico mensual"))
                    .header(HttpHeaders.AUTHORIZATION, usuarios.bearer(usuarios.crear(rol).id())))
                    .andExpect(status().isForbidden());
        }
    }

    @Test
    void movimientosFiltradosPorProductoTipoYFechaLosMasRecientesPrimero() throws Exception {
        mvc.perform(comoAlmacen(post(AJUSTES)).content(ajuste("ENTRADA", "10", "1000", "Inventario inicial")));
        mvc.perform(comoAlmacen(post(AJUSTES)).content(ajuste("SALIDA", "3", null, "Unidades vencidas")));

        mvc.perform(comoAlmacen(get(MOVIMIENTOS)).param("productoId", String.valueOf(producto.getId())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(2))
                .andExpect(jsonPath("$.content[0].tipo").value("SALIDA_AJUSTE"))
                .andExpect(jsonPath("$.content[0].stockResultante").value(7))
                .andExpect(jsonPath("$.content[1].tipo").value("ENTRADA_AJUSTE"));
        mvc.perform(comoAlmacen(get(MOVIMIENTOS)).param("productoId", String.valueOf(producto.getId()))
                .param("tipo", "ENTRADA_AJUSTE").param("usuarioId", String.valueOf(almacen.id())))
                .andExpect(jsonPath("$.totalElements").value(1));
        String manana = Instant.now().plus(1, ChronoUnit.DAYS).toString();
        mvc.perform(comoAlmacen(get(MOVIMIENTOS)).param("productoId", String.valueOf(producto.getId()))
                .param("desde", manana))
                .andExpect(jsonPath("$.totalElements").value(0));
    }

    @Test
    void exportaCsvParaExcelSinFormulasInyectadas() throws Exception {
        mvc.perform(comoAlmacen(post(AJUSTES)).content(ajuste("ENTRADA", "4", "1500", "=HYPERLINK(\\\"x\\\") prueba")));

        byte[] cuerpo = mvc.perform(comoAlmacen(get(MOVIMIENTOS + "/exportar"))
                .param("productoId", String.valueOf(producto.getId())))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CONTENT_TYPE, startsWith("text/csv")))
                .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"movimientos-inventario.csv\""))
                .andReturn().getResponse().getContentAsByteArray();
        String[] lineas = new String(cuerpo, StandardCharsets.UTF_8).split("\r\n");

        assertThat(lineas[0]).isEqualTo("﻿fecha;tipo;codigo;producto;cantidad;costo_unitario;stock_resultante;"
                + "referencia;motivo;usuario");
        assertThat(lineas).hasSize(2);
        assertThat(lineas[1]).contains(";ENTRADA_AJUSTE;\"" + producto.getCodigo() + "\";\"Producto de prueba\";4;1500;4;;")
                .contains(";\"'=HYPERLINK(\"\"x\"\") prueba\";\"Prueba ALMACEN\"");
    }

    @Test
    void soloAlmacenYAdminVenLosMovimientos() throws Exception {
        for (Rol rol : new Rol[] { Rol.VENDEDOR, Rol.MECANICO }) {
            String bearer = usuarios.bearer(usuarios.crear(rol).id());
            mvc.perform(get(MOVIMIENTOS).header(HttpHeaders.AUTHORIZATION, bearer)).andExpect(status().isForbidden());
            mvc.perform(get(MOVIMIENTOS + "/exportar").header(HttpHeaders.AUTHORIZATION, bearer))
                    .andExpect(status().isForbidden());
        }
        mvc.perform(get(MOVIMIENTOS).header(HttpHeaders.AUTHORIZATION,
                usuarios.bearer(usuarios.crear(Rol.ADMIN).id()))).andExpect(status().isOk());
    }

    private MockHttpServletRequestBuilder comoAlmacen(MockHttpServletRequestBuilder peticion) {
        return peticion.header(HttpHeaders.AUTHORIZATION, bearerAlmacen).contentType(MediaType.APPLICATION_JSON);
    }

    private String ajuste(String tipo, String cantidad, String costo, String motivo) {
        return """
                {"productoId":%d,"tipo":"%s","cantidad":%s,"costoUnitario":%s,"motivo":"%s"}"""
                .formatted(producto.getId(), tipo, cantidad, costo, motivo);
    }
}

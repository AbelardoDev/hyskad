package com.hyskad.servicios.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.hyskad.support.IntegrationTest;
import com.hyskad.support.UsuariosDePrueba;
import com.hyskad.usuarios.domain.Rol;

import tools.jackson.databind.ObjectMapper;

/** Catálogo de servicios del taller (RF16). */
@IntegrationTest
class ServicioControllerIT {

    private static final String BASE = "/api/v1/servicios";

    @Autowired
    private MockMvc mvc;

    @Autowired
    private UsuariosDePrueba usuarios;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private ObjectMapper json;

    private String admin;

    @BeforeEach
    void iniciar() {
        admin = usuarios.bearer(usuarios.crear(Rol.ADMIN).id());
    }

    @Test
    void creaNormalizadoYAudita() throws Exception {
        String nombre = "Servicio " + UUID.randomUUID();
        String respuesta = mvc.perform(con(post(BASE), admin).content("""
                {"nombre":"  %s  ","descripcion":"  ","precioBase":45000,"tiempoEstimadoMin":60}""".formatted(nombre)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.nombre").value(nombre))
                .andExpect(jsonPath("$.descripcion").doesNotExist())
                .andExpect(jsonPath("$.precioBase").value(45000))
                .andExpect(jsonPath("$.tiempoEstimadoMin").value(60))
                .andExpect(jsonPath("$.activo").value(true))
                .andReturn().getResponse().getContentAsString();
        long id = json.readTree(respuesta).get("id").asLong();

        assertThat(jdbc.queryForObject("select count(*) from auditoria where accion = 'SERVICIO_CREADO' "
                + "and entidad_id = ?", Integer.class, id)).isOne();
    }

    @Test
    void elNombreEsUnicoSinImportarMayusculas() throws Exception {
        String nombre = "Único " + UUID.randomUUID();
        crear(nombre);
        mvc.perform(con(post(BASE), admin).content(cuerpo(nombre.toUpperCase(), 1000, 10)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("SERVICIO_DUPLICADO"));

        long otro = crear("Otro " + UUID.randomUUID());
        mvc.perform(con(put(BASE + "/" + otro), admin).content(cuerpo(nombre, 1000, 10)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("SERVICIO_DUPLICADO"));
    }

    @Test
    void precioYTiempoDebenSerPositivos() throws Exception {
        mvc.perform(con(post(BASE), admin).content(cuerpo("Gratis " + UUID.randomUUID(), 0, 0)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDACION"))
                .andExpect(jsonPath("$.errors[*].campo").value(containsInAnyOrder(
                        "precioBase", "tiempoEstimadoMin")));
    }

    @Test
    void actualizaAuditandoLosCamposYSeDesactiva() throws Exception {
        String nombre = "Editable " + UUID.randomUUID();
        long id = crear(nombre);
        mvc.perform(con(put(BASE + "/" + id), admin).content(cuerpo(nombre, 30000, 45)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.precioBase").value(30000));
        assertThat(jdbc.queryForObject("select detalle->>'$.campos' from auditoria where accion = "
                + "'SERVICIO_ACTUALIZADO' and entidad_id = ?", String.class, id))
                .isEqualTo("[\"precioBase\", \"tiempoEstimadoMin\"]");

        mvc.perform(con(patch(BASE + "/" + id + "/estado"), admin).content("{\"activo\":false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.activo").value(false));
        mvc.perform(con(get(BASE).param("q", nombre).param("activo", "true"), admin))
                .andExpect(jsonPath("$.content[*].id").value(not(hasItem((int) id))));
        mvc.perform(con(get(BASE).param("q", nombre), admin))
                .andExpect(jsonPath("$.totalElements").value(1));
    }

    @Test
    void loGestionaElAdminYLoConsultaQuienTrabajaOrdenes() throws Exception {
        long id = crear("Consulta " + UUID.randomUUID());
        String vendedor = usuarios.bearer(usuarios.crear(Rol.VENDEDOR).id());
        String mecanico = usuarios.bearer(usuarios.crear(Rol.MECANICO).id());
        String almacen = usuarios.bearer(usuarios.crear(Rol.ALMACEN).id());

        mvc.perform(con(get(BASE + "/" + id), vendedor)).andExpect(status().isOk());
        mvc.perform(con(get(BASE), mecanico)).andExpect(status().isOk());
        mvc.perform(con(get(BASE), almacen)).andExpect(status().isForbidden());
        mvc.perform(con(post(BASE), vendedor).content(cuerpo("No " + UUID.randomUUID(), 1000, 10)))
                .andExpect(status().isForbidden());
        mvc.perform(get(BASE)).andExpect(status().isUnauthorized());
        mvc.perform(con(get(BASE + "/999999999"), admin))
                .andExpect(status().isNotFound());
    }

    private long crear(String nombre) throws Exception {
        String respuesta = mvc.perform(con(post(BASE), admin).content(cuerpo(nombre, 25000, 30)))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(respuesta).get("id").asLong();
    }

    private static String cuerpo(String nombre, int precio, int minutos) {
        return """
                {"nombre":"%s","precioBase":%d,"tiempoEstimadoMin":%d}""".formatted(nombre, precio, minutos);
    }

    private static MockHttpServletRequestBuilder con(MockHttpServletRequestBuilder peticion, String bearer) {
        return peticion.header(HttpHeaders.AUTHORIZATION, bearer).contentType(MediaType.APPLICATION_JSON);
    }
}

package com.hyskad.proveedores.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.hyskad.support.Identificadores;
import com.hyskad.support.IntegrationTest;
import com.hyskad.support.UsuariosDePrueba;
import com.hyskad.usuarios.domain.Rol;

import tools.jackson.databind.ObjectMapper;

@IntegrationTest
class ProveedorControllerIT {

    private static final String BASE = "/api/v1/proveedores";

    @Autowired
    private MockMvc mvc;

    @Autowired
    private UsuariosDePrueba usuarios;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private ObjectMapper json;

    private String bearer;

    @BeforeEach
    void iniciar() {
        bearer = usuarios.bearer(usuarios.crear(Rol.ALMACEN).id());
    }

    @Test
    void cp28CrudDeProveedorConNitValido() throws Exception {
        String nit = Identificadores.nit();
        String conDv = nit.substring(0, 9) + "-" + nit.substring(9);

        String respuesta = mvc.perform(conToken(post(BASE)).content(proveedor(nit, "Repuestos Uno S.A.S.")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.numeroDocumento").value(conDv))
                .andExpect(jsonPath("$.telefono").value("6047853210"))
                .andExpect(jsonPath("$.activo").value(true))
                .andReturn().getResponse().getContentAsString();
        long id = json.readTree(respuesta).get("id").asLong();

        mvc.perform(conToken(get(BASE + "/" + id))).andExpect(jsonPath("$.razonSocial").value("Repuestos Uno S.A.S."));
        mvc.perform(conToken(put(BASE + "/" + id)).content(proveedor(nit, "Repuestos Uno Ltda.")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.razonSocial").value("Repuestos Uno Ltda."));
        mvc.perform(conToken(get(BASE)).param("q", nit.substring(0, 6)))
                .andExpect(jsonPath("$.content[0].id").value(id));
        mvc.perform(conToken(patch(BASE + "/" + id + "/estado")).content("{\"activo\":false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.activo").value(false));
        assertThat(jdbc.queryForList("select accion from auditoria where entidad = 'proveedor' and entidad_id = ? "
                + "order by id", String.class, id))
                .containsExactly("PROVEEDOR_CREADO", "PROVEEDOR_ACTUALIZADO", "PROVEEDOR_DESACTIVADO");
    }

    @Test
    void nitInvalidoYDocumentoDuplicado() throws Exception {
        String nit = Identificadores.nit();
        String dvMalo = nit.substring(0, 9) + ((Character.digit(nit.charAt(9), 10) + 1) % 10);
        mvc.perform(conToken(post(BASE)).content(proveedor(dvMalo, "Malo")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].code").value("NIT_INVALIDO"));

        mvc.perform(conToken(post(BASE)).content(proveedor(nit, "Primero"))).andExpect(status().isCreated());
        mvc.perform(conToken(post(BASE)).content(proveedor(nit, "Segundo")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DOCUMENTO_DUPLICADO"));
    }

    @Test
    void soloQuienGestionaProveedores() throws Exception {
        for (Rol rol : new Rol[] { Rol.VENDEDOR, Rol.MECANICO }) {
            mvc.perform(get(BASE).header(HttpHeaders.AUTHORIZATION, usuarios.bearer(usuarios.crear(rol).id())))
                    .andExpect(status().isForbidden());
        }
        mvc.perform(get(BASE)).andExpect(status().isUnauthorized());
    }

    private MockHttpServletRequestBuilder conToken(MockHttpServletRequestBuilder peticion) {
        return peticion.header(HttpHeaders.AUTHORIZATION, bearer).contentType(MediaType.APPLICATION_JSON);
    }

    private static String proveedor(String nit, String razonSocial) {
        return """
                {"tipoDocumento":"NIT","numeroDocumento":"%s","razonSocial":"%s","telefono":"604 785 3210"}"""
                .formatted(nit, razonSocial);
    }
}

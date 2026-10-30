package com.hyskad.clientes.web;

import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import com.hyskad.clientes.application.ConsultaOrdenesActivas;
import com.hyskad.support.Identificadores;
import com.hyskad.support.IntegrationTest;
import com.hyskad.support.UsuariosDePrueba;
import com.hyskad.usuarios.domain.Rol;

import tools.jackson.databind.ObjectMapper;

/**
 * RN-44 (CP-19) con un doble de {@link ConsultaOrdenesActivas}: el módulo {@code taller}, que la
 * implementará, llega en F09A.
 */
@IntegrationTest
class OrdenesActivasIT {

    @MockitoBean
    private ConsultaOrdenesActivas ordenesActivas;

    @Autowired
    private MockMvc mvc;

    @Autowired
    private UsuariosDePrueba usuarios;

    @Autowired
    private ObjectMapper json;

    private String bearer;

    @BeforeEach
    void iniciar() {
        bearer = usuarios.bearer(usuarios.crear(Rol.ADMIN).id());
        when(ordenesActivas.clienteTieneOrdenesActivas(anyLong())).thenReturn(true);
        when(ordenesActivas.tieneOrdenActiva(anyLong())).thenReturn(true);
    }

    @Test
    void cp19NoSeDesactivaUnClienteNiUnaMotoConOrdenesActivas() throws Exception {
        long cliente = crear("/api/v1/clientes", """
                {"tipoDocumento":"CC","numeroDocumento":"%s","nombres":"Con","apellidos":"Orden",
                 "telefono":"3001234567","aceptaTratamientoDatos":true}""".formatted(Identificadores.cedula()));
        long moto = crear("/api/v1/motocicletas", """
                {"clienteId":%d,"placa":"%s","marca":"Honda","modelo":"CB 190R"}"""
                .formatted(cliente, Identificadores.placa()));

        mvc.perform(conToken(patch("/api/v1/clientes/" + cliente + "/estado")).content("{\"activo\":false}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ORDENES_ACTIVAS"));
        mvc.perform(conToken(patch("/api/v1/motocicletas/" + moto + "/estado")).content("{\"activo\":false}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ORDENES_ACTIVAS"));
    }

    private long crear(String ruta, String cuerpo) throws Exception {
        String respuesta = mvc.perform(conToken(post(ruta)).content(cuerpo))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        return json.readTree(respuesta).get("id").asLong();
    }

    private MockHttpServletRequestBuilder conToken(MockHttpServletRequestBuilder peticion) {
        return peticion.header(HttpHeaders.AUTHORIZATION, bearer).contentType(MediaType.APPLICATION_JSON);
    }
}

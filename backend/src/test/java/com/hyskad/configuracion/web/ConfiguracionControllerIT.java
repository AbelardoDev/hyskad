package com.hyskad.configuracion.web;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.test.web.servlet.MockMvc;

import com.hyskad.support.IntegrationTest;
import com.hyskad.support.UsuariosDePrueba;
import com.hyskad.usuarios.domain.Rol;

@IntegrationTest
class ConfiguracionControllerIT {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private UsuariosDePrueba usuarios;

    @Test
    void cualquierUsuarioAutenticadoLeeElIvaVigente() throws Exception {
        mvc.perform(get("/api/v1/configuracion/iva")
                .header(HttpHeaders.AUTHORIZATION, usuarios.bearer(usuarios.crear(Rol.MECANICO).id())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.porcentaje").value(19));
        mvc.perform(get("/api/v1/configuracion/iva")).andExpect(status().isUnauthorized());
    }
}

package com.hyskad.e2e.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.http.HttpHeaders;
import org.springframework.test.web.servlet.MockMvc;

import com.hyskad.support.IntegrationTest;
import com.hyskad.support.UsuariosDePrueba;
import com.hyskad.usuarios.domain.Rol;

/** El reinicio de datos de las E2E no existe fuera del perfil {@code e2e} (TEST-PLAN §4). */
@IntegrationTest
class ReinicioDatosControllerIT {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ApplicationContext contexto;

    @Autowired
    private UsuariosDePrueba usuarios;

    @Test
    void sinPerfilE2eNoSeRegistraElController() {
        assertThat(contexto.getBeanNamesForType(ReinicioDatosController.class)).isEmpty();
    }

    @Test
    void sinPerfilE2eLaRutaNoEsPublica() throws Exception {
        mvc.perform(post(ReinicioDatosController.RUTA_RESET))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void sinPerfilE2eNiUnAdminLaEncuentra() throws Exception {
        String bearer = usuarios.bearer(usuarios.crear(Rol.ADMIN).id());

        mvc.perform(post(ReinicioDatosController.RUTA_RESET).header(HttpHeaders.AUTHORIZATION, bearer))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("RUTA_NO_ENCONTRADA"));
    }
}

package com.hyskad.shared.audit;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import com.hyskad.support.IntegrationTest;

@IntegrationTest
class AuditoriaServiceIT {

    @Autowired
    private AuditoriaService service;

    @Autowired
    private JdbcTemplate jdbc;

    @AfterEach
    void limpiarContexto() {
        RequestContextHolder.resetRequestAttributes();
    }

    @Test
    void registraLaAccionConDetalleJsonEIpDeLaPeticion() {
        MockHttpServletRequest peticion = new MockHttpServletRequest();
        peticion.setRemoteAddr("203.0.113.5");
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(peticion));

        service.registrar("PRUEBA_CON_IP", "producto", 7L, Map.of("campo", "precio", "antes", 10));

        Map<String, Object> fila = fila("PRUEBA_CON_IP");
        assertThat(fila.get("usuario_id")).isNull();
        assertThat(fila).containsEntry("ip", "203.0.113.5")
                .containsEntry("entidad", "producto")
                .containsEntry("entidad_id", 7L);
        assertThat(fila.get("campo")).hasToString("\"precio\"");
        assertThat(fila.get("fecha")).isNotNull();
    }

    @Test
    void fueraDeUnaPeticionGuardaSinIpNiDetalleVacio() {
        RequestContextHolder.resetRequestAttributes();

        service.registrar("PRUEBA_SIN_IP", "sistema", null, Map.of());

        Map<String, Object> fila = fila("PRUEBA_SIN_IP");
        assertThat(fila.get("ip")).isNull();
        assertThat(fila.get("campo")).isNull();
    }

    private Map<String, Object> fila(String accion) {
        return jdbc.queryForMap("select usuario_id, entidad, entidad_id, ip, json_extract(detalle, '$.campo') campo, "
                + "fecha from auditoria where accion = ?", accion);
    }
}

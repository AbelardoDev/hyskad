package com.hyskad.notificaciones.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

import java.time.Duration;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;

import com.hyskad.support.FlujoOrdenes;
import com.hyskad.support.IntegrationTest;
import com.hyskad.support.UsuariosDePrueba;
import com.hyskad.usuarios.domain.Rol;

import tools.jackson.databind.JsonNode;

/** CP-54: sin SMTP disponible (nada escucha en el 3025) la orden avanza y el fallo queda en el log. */
@IntegrationTest
@ExtendWith(OutputCaptureExtension.class)
class FalloCorreoIT {

    @Autowired
    private UsuariosDePrueba usuarios;

    @Autowired
    private FlujoOrdenes flujo;

    @Test
    void cp54UnFalloDelSmtpNoRevierteLaOperacion(CapturedOutput salida) throws Exception {
        String admin = usuarios.bearer(usuarios.crear(Rol.ADMIN).id());
        String vendedor = usuarios.bearer(usuarios.crear(Rol.VENDEDOR).id());
        long mecanicoId = usuarios.crear(Rol.MECANICO).id();
        String mecanico = usuarios.bearer(mecanicoId);

        JsonNode orden = flujo.finalizada(flujo.clienteConMoto(admin, "sin-smtp-" + System.nanoTime() + "@cliente.test",
                true), 100, 100000, vendedor, mecanicoId, mecanico);

        assertThat(orden.get("estado").asString()).isEqualTo("FINALIZADA");
        assertThat(flujo.obtener(orden, vendedor).get("estado").asString()).isEqualTo("FINALIZADA");
        // 1 intento + 2 reintentos con espera creciente; luego el error, con el requestId de la petición
        await().atMost(Duration.ofSeconds(15))
                .until(() -> salida.getOut().contains("No se pudo enviar el correo 'orden-lista' tras 3 intentos"));
        assertThat(salida.getOut()).contains("Falló el envío del correo 'orden-lista' (intento 2 de 3)");
        String error = salida.getOut().lines().filter(l -> l.contains("No se pudo enviar el correo 'orden-lista'"))
                .findFirst().orElseThrow();
        assertThat(error).containsPattern("\\[[0-9a-f-]{36}\\]").doesNotContain("@cliente.test");
    }
}

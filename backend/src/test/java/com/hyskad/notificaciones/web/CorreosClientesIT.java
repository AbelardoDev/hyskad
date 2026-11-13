package com.hyskad.notificaciones.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

import java.time.Duration;
import java.util.Arrays;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.RegisterExtension;
import org.springframework.beans.factory.annotation.Autowired;

import com.hyskad.support.FlujoOrdenes;
import com.hyskad.support.FlujoOrdenes.ClienteMoto;
import com.hyskad.support.IntegrationTest;
import com.hyskad.support.UsuariosDePrueba;
import com.hyskad.usuarios.domain.Rol;
import com.icegreen.greenmail.junit5.GreenMailExtension;
import com.icegreen.greenmail.util.GreenMailUtil;
import com.icegreen.greenmail.util.ServerSetupTest;

import jakarta.mail.Address;
import jakarta.mail.internet.MimeMessage;
import tools.jackson.databind.JsonNode;

/** Correos a clientes con un SMTP en memoria (GreenMail, puerto 3025 del perfil test): RN-45 y CP-53. */
@IntegrationTest
class CorreosClientesIT {

    @RegisterExtension
    static final GreenMailExtension SMTP = new GreenMailExtension(ServerSetupTest.SMTP).withPerMethodLifecycle(true);

    private static final Duration ESPERA = Duration.ofSeconds(10);

    @Autowired
    private UsuariosDePrueba usuarios;

    @Autowired
    private FlujoOrdenes flujo;

    private String admin;
    private String vendedor;
    private long mecanicoId;
    private String mecanico;

    @BeforeEach
    void iniciar() {
        admin = usuarios.bearer(usuarios.crear(Rol.ADMIN).id());
        vendedor = usuarios.bearer(usuarios.crear(Rol.VENDEDOR).id());
        mecanicoId = usuarios.crear(Rol.MECANICO).id();
        mecanico = usuarios.bearer(mecanicoId);
    }

    @Test
    void cp53LaOrdenFinalizadaAvisaSoloAlClienteQueAutorizoYTieneEmail() throws Exception {
        String autorizo = "autorizo-" + System.nanoTime() + "@cliente.test";
        String noAutorizo = "no-autorizo-" + System.nanoTime() + "@cliente.test";
        ClienteMoto conPermiso = flujo.clienteConMoto(admin, autorizo, true);
        ClienteMoto sinPermiso = flujo.clienteConMoto(admin, noAutorizo, false);

        JsonNode orden = flujo.finalizada(conPermiso, 100, 100000, vendedor, mecanicoId, mecanico);
        flujo.finalizada(sinPermiso, 100, 100000, vendedor, mecanicoId, mecanico);

        // Del cliente con permiso: ingreso, presupuesto y moto lista (3 correos)
        await().atMost(ESPERA).until(() -> para(autorizo).length == 3);
        MimeMessage lista = Arrays.stream(para(autorizo))
                .filter(m -> asunto(m).equals("Tu moto está lista para recoger")).findFirst().orElseThrow();
        String cuerpo = GreenMailUtil.getBody(lista);
        assertThat(cuerpo).contains(orden.get("numero").asString()).contains("119.000").contains("cid:logo");
        assertThat(Arrays.stream(para(autorizo)).map(CorreosClientesIT::asunto)).contains(
                "Recibimos tu moto en el taller", "Tu presupuesto está listo para aprobar");
        // RN-45: sin autorización no se le escribe nunca
        Thread.sleep(500);
        assertThat(para(noAutorizo)).isEmpty();
    }

    @Test
    void laEntregaEnviaElResumenConElTotalPagado() throws Exception {
        String email = "entrega-" + System.nanoTime() + "@cliente.test";
        JsonNode orden = flujo.entregada(flujo.clienteConMoto(admin, email, true), 100, 50000, vendedor, mecanicoId,
                mecanico);

        await().atMost(ESPERA).until(() -> Arrays.stream(para(email))
                .anyMatch(m -> asunto(m).equals("Entregamos tu moto")));
        MimeMessage entrega = Arrays.stream(para(email)).filter(m -> asunto(m).equals("Entregamos tu moto"))
                .findFirst().orElseThrow();
        assertThat(GreenMailUtil.getBody(entrega)).contains(orden.get("numero").asString()).contains("59.500")
                .contains("Efectivo");
    }

    private static MimeMessage[] para(String email) {
        return Arrays.stream(SMTP.getReceivedMessages()).filter(m -> destinatarios(m).contains(email))
                .toArray(MimeMessage[]::new);
    }

    private static String destinatarios(MimeMessage m) {
        try {
            Address[] a = m.getAllRecipients();
            return a == null ? "" : Arrays.toString(a);
        } catch (jakarta.mail.MessagingException e) {
            throw new IllegalStateException(e);
        }
    }

    private static String asunto(MimeMessage m) {
        try {
            return m.getSubject();
        } catch (jakarta.mail.MessagingException e) {
            throw new IllegalStateException(e);
        }
    }
}

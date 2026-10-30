package com.hyskad.auth.application;

import java.util.Locale;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionalEventListener;

import com.hyskad.shared.correo.CorreoService;

/** Envía el correo de recuperación en el idioma del usuario, fuera de la transacción y sin bloquear la respuesta. */
@Component
public class CorreoRecuperacionListener {

    static final String PLANTILLA = "recuperacion-password";

    private final CorreoService correos;
    private final String baseUrl;

    public CorreoRecuperacionListener(CorreoService correos, @Value("${hyskad.base-url}") String baseUrl) {
        this.correos = correos;
        this.baseUrl = baseUrl;
    }

    @Async
    @TransactionalEventListener
    public void enviar(RecuperacionSolicitada evento) {
        String enlace = baseUrl + "/restablecer?token=" + evento.token();
        correos.enviar(evento.email(), PLANTILLA, Locale.forLanguageTag(evento.idioma()),
                Map.of("nombre", evento.nombre(), "enlace", enlace, "minutos", evento.minutosVigencia()));
    }
}

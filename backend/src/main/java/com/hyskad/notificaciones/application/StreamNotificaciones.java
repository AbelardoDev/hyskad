package com.hyskad.notificaciones.application;

import java.io.IOException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import com.hyskad.usuarios.domain.AccesoUsuarioModificado;

/**
 * Conexiones SSE abiertas por usuario (IC5), en memoria: un usuario puede tener varias pestañas.
 * Como {@code EventSource} no envía cabeceras, el stream se abre con un ticket de un solo uso que
 * vence a los 30 s, pedido antes con el JWT. Un latido cada 25 s mantiene viva la conexión a
 * través de proxies.
 */
@Component
public class StreamNotificaciones {

    static final Duration VIGENCIA_TICKET = Duration.ofSeconds(30);
    /** Larga a propósito: el cliente reconecta solo si se corta. */
    static final long TIMEOUT_MS = Duration.ofMinutes(30).toMillis();
    static final String EVENTO = "notificacion";

    private static final Logger log = LoggerFactory.getLogger(StreamNotificaciones.class);
    private static final SecureRandom AZAR = new SecureRandom();

    private final Map<String, Ticket> tickets = new ConcurrentHashMap<>();
    private final Map<Long, List<SseEmitter>> emisores = new ConcurrentHashMap<>();
    private final Clock clock;

    public StreamNotificaciones(Clock clock) {
        this.clock = clock;
    }

    /** Ticket aleatorio para abrir el stream; vence a los 30 s y solo sirve una vez. */
    public String emitirTicket(Long usuarioId) {
        Instant ahora = Instant.now(clock);
        tickets.values().removeIf(t -> !t.vence().isAfter(ahora));
        byte[] bytes = new byte[32];
        AZAR.nextBytes(bytes);
        String valor = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        tickets.put(valor, new Ticket(usuarioId, ahora.plus(VIGENCIA_TICKET)));
        return valor;
    }

    /** Canjea el ticket (se borra aunque esté vencido); vacío si no existe o ya venció. */
    public Optional<Long> canjear(String ticket) {
        Ticket t = ticket == null ? null : tickets.remove(ticket);
        return t != null && t.vence().isAfter(Instant.now(clock)) ? Optional.of(t.usuarioId()) : Optional.empty();
    }

    public SseEmitter abrir(Long usuarioId) {
        SseEmitter emisor = new SseEmitter(TIMEOUT_MS);
        List<SseEmitter> delUsuario = emisores.computeIfAbsent(usuarioId, id -> new CopyOnWriteArrayList<>());
        delUsuario.add(emisor);
        Runnable quitar = () -> quitar(usuarioId, emisor);
        emisor.onCompletion(quitar);
        emisor.onTimeout(quitar);
        emisor.onError(e -> quitar.run());
        // Primer mensaje: confirma la conexión y hace que los proxies envíen las cabeceras ya
        enviar(usuarioId, emisor, SseEmitter.event().comment("conectado"));
        return emisor;
    }

    /** Empuja la notificación a todas las pestañas abiertas del usuario; sin conexión no hace nada. */
    public void enviar(Long usuarioId, AvisoTiempoReal aviso) {
        emisores.getOrDefault(usuarioId, List.of())
                .forEach(e -> enviar(usuarioId, e, SseEmitter.event().name(EVENTO).id(String.valueOf(aviso.id()))
                        .data(aviso)));
    }

    /** Cierra las conexiones del usuario (al desactivarlo o cambiar su acceso). */
    public void cerrar(Long usuarioId) {
        List<SseEmitter> delUsuario = emisores.remove(usuarioId);
        if (delUsuario != null) {
            delUsuario.forEach(SseEmitter::complete);
        }
    }

    /** RN-48: al desactivar al usuario o cambiar su acceso se cortan sus streams (reconecta con un ticket nuevo). */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void alModificarAcceso(AccesoUsuarioModificado evento) {
        cerrar(evento.usuarioId());
    }

    public int conexiones(Long usuarioId) {
        return emisores.getOrDefault(usuarioId, List.of()).size();
    }

    @Scheduled(fixedRate = 25_000, initialDelay = 25_000)
    void latido() {
        emisores.forEach((usuarioId, lista) -> lista
                .forEach(e -> enviar(usuarioId, e, SseEmitter.event().comment("latido"))));
    }

    private void enviar(Long usuarioId, SseEmitter emisor, SseEmitter.SseEventBuilder evento) {
        try {
            emisor.send(evento);
        } catch (IOException | IllegalStateException e) {
            // El navegador se fue: se descarta la conexión sin ruido en el log
            log.debug("Conexión SSE cerrada del usuario {}", usuarioId);
            quitar(usuarioId, emisor);
        }
    }

    private void quitar(Long usuarioId, SseEmitter emisor) {
        emisores.computeIfPresent(usuarioId, (id, lista) -> {
            lista.remove(emisor);
            return lista.isEmpty() ? null : lista;
        });
    }

    private record Ticket(Long usuarioId, Instant vence) {
    }
}

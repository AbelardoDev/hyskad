package com.hyskad.notificaciones.application;

import java.time.Clock;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Map;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import com.hyskad.notificaciones.domain.Notificacion;
import com.hyskad.notificaciones.domain.TipoNotificacion;
import com.hyskad.notificaciones.persistence.NotificacionRepository;
import com.hyskad.shared.error.NotFoundException;
import com.hyskad.shared.security.UsuarioActual;

/**
 * Notificaciones internas (RF30): guarda una por destinatario y, cuando la transacción se confirma,
 * la empuja por SSE a quien esté conectado. Cada usuario solo ve y marca las suyas; las de otro
 * responden 404.
 */
@Service
public class NotificacionService {

    static final String ENTIDAD = "notificacion";

    private final NotificacionRepository repository;
    private final StreamNotificaciones stream;
    private final UsuarioActual usuarioActual;
    private final Clock clock;

    public NotificacionService(NotificacionRepository repository, StreamNotificaciones stream,
            UsuarioActual usuarioActual, Clock clock) {
        this.repository = repository;
        this.stream = stream;
        this.usuarioActual = usuarioActual;
        this.clock = clock;
    }

    @Transactional
    public List<Notificacion> notificar(TipoNotificacion tipo, Collection<Long> destinatarios,
            Map<String, Object> parametros, String enlace) {
        Instant ahora = Instant.now(clock);
        List<Notificacion> creadas = repository.saveAll(destinatarios.stream().distinct()
                .map(usuarioId -> new Notificacion(usuarioId, tipo, parametros, enlace, ahora)).toList());
        Runnable empujar = () -> creadas.forEach(n -> stream.enviar(n.getUsuarioId(), AvisoTiempoReal.de(n)));
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    empujar.run();
                }
            });
        } else {
            empujar.run();
        }
        return creadas;
    }

    /** Las del usuario actual, la más reciente primero. */
    @Transactional(readOnly = true)
    public Page<Notificacion> mias(boolean soloNoLeidas, Pageable pagina) {
        Long usuarioId = usuarioActual.idRequerido();
        return soloNoLeidas ? repository.findByUsuarioIdAndLeidaFalse(usuarioId, pagina)
                : repository.findByUsuarioId(usuarioId, pagina);
    }

    @Transactional(readOnly = true)
    public long conteoNoLeidas() {
        return repository.countByUsuarioIdAndLeidaFalse(usuarioActual.idRequerido());
    }

    @Transactional
    public Notificacion marcarLeida(Long id) {
        Notificacion n = repository.findByIdAndUsuarioId(id, usuarioActual.idRequerido())
                .orElseThrow(() -> new NotFoundException(ENTIDAD, id));
        n.marcarLeida();
        return n;
    }

    @Transactional
    public int marcarTodasLeidas() {
        return repository.marcarTodasLeidas(usuarioActual.idRequerido());
    }
}

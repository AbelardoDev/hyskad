package com.hyskad.shared.audit;

import java.time.Clock;
import java.time.Instant;
import java.util.Map;

import org.springframework.data.domain.AuditorAware;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hyskad.shared.security.UsuarioActual;

/**
 * Registra acciones en la tabla {@code auditoria}. El usuario sale del mismo {@link AuditorAware}
 * de JPA Auditing (o se indica explícitamente, p. ej. en el login) y la IP de la petición en curso;
 * ambos pueden ser vacíos (procesos internos).
 * Participa en la transacción del llamador: si la operación se revierte, el registro también.
 */
@Service
public class AuditoriaService {

    private final AuditoriaRepository repository;
    private final AuditorAware<Long> auditorActual;
    private final UsuarioActual usuarioActual;
    private final Clock clock;

    public AuditoriaService(AuditoriaRepository repository, AuditorAware<Long> auditorActual,
            UsuarioActual usuarioActual, Clock clock) {
        this.repository = repository;
        this.auditorActual = auditorActual;
        this.usuarioActual = usuarioActual;
        this.clock = clock;
    }

    @Transactional
    public void registrar(String accion, String entidad, Long entidadId, Map<String, Object> detalle) {
        registrarComo(auditorActual.getCurrentAuditor().orElse(null), accion, entidad, entidadId, detalle);
    }

    /** Para acciones sin sesión autenticada en las que ya se sabe quién actúa (login, recuperación). */
    @Transactional
    public void registrarComo(Long usuarioId, String accion, String entidad, Long entidadId,
            Map<String, Object> detalle) {
        repository.save(new Auditoria(usuarioId, accion, entidad, entidadId,
                detalle == null || detalle.isEmpty() ? null : Map.copyOf(detalle), usuarioActual.ip().orElse(null),
                Instant.now(clock)));
    }
}

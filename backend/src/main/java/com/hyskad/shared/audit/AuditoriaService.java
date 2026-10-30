package com.hyskad.shared.audit;

import java.time.Clock;
import java.time.Instant;
import java.util.Map;

import org.springframework.data.domain.AuditorAware;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/**
 * Registra acciones en la tabla {@code auditoria}. El usuario sale del mismo {@link AuditorAware}
 * de JPA Auditing y la IP de la petición en curso; ambos pueden ser vacíos (procesos internos).
 * Participa en la transacción del llamador: si la operación se revierte, el registro también.
 */
@Service
public class AuditoriaService {

    private final AuditoriaRepository repository;
    private final AuditorAware<Long> auditorActual;
    private final Clock clock;

    public AuditoriaService(AuditoriaRepository repository, AuditorAware<Long> auditorActual, Clock clock) {
        this.repository = repository;
        this.auditorActual = auditorActual;
        this.clock = clock;
    }

    @Transactional
    public void registrar(String accion, String entidad, Long entidadId, Map<String, Object> detalle) {
        Long usuarioId = auditorActual.getCurrentAuditor().orElse(null);
        repository.save(new Auditoria(usuarioId, accion, entidad, entidadId,
                detalle == null || detalle.isEmpty() ? null : Map.copyOf(detalle), ipActual(), Instant.now(clock)));
    }

    private static String ipActual() {
        if (RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes atributos) {
            return atributos.getRequest().getRemoteAddr();
        }
        return null;
    }
}

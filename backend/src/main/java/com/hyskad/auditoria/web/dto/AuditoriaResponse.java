package com.hyskad.auditoria.web.dto;

import java.time.Instant;
import java.util.Map;

/** Registro de auditoría (RF31, RN-51) con el nombre de quien actuó. {@code detalle} nunca trae secretos. */
public record AuditoriaResponse(Long id, Instant fecha, Usuario usuario, String accion, String entidad, Long entidadId,
        Map<String, Object> detalle, String ip) {

    public record Usuario(Long id, String nombre) {
    }
}

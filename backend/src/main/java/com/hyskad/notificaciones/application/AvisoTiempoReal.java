package com.hyskad.notificaciones.application;

import java.time.Instant;
import java.util.Map;

import com.hyskad.notificaciones.domain.Notificacion;
import com.hyskad.notificaciones.domain.TipoNotificacion;

/** Lo que viaja por SSE cuando llega una notificación nueva (evento {@code notificacion}). */
public record AvisoTiempoReal(Long id, TipoNotificacion tipo, String tituloClave, String mensajeClave,
        Map<String, Object> parametros, String enlace, boolean leida, Instant fecha) {

    static AvisoTiempoReal de(Notificacion n) {
        return new AvisoTiempoReal(n.getId(), n.getTipo(), n.getTituloClave(), n.getMensajeClave(),
                n.getParametros() == null ? Map.of() : n.getParametros(), n.getEnlace(), n.isLeida(), n.getFecha());
    }
}

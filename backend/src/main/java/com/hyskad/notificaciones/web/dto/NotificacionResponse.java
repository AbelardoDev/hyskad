package com.hyskad.notificaciones.web.dto;

import java.time.Instant;
import java.util.Map;

import com.hyskad.notificaciones.domain.TipoNotificacion;

/** Notificación con sus claves de i18n y parámetros; el frontend arma el texto en el idioma del usuario. */
public record NotificacionResponse(Long id, TipoNotificacion tipo, String tituloClave, String mensajeClave,
        Map<String, Object> parametros, String enlace, boolean leida, Instant fecha) {
}

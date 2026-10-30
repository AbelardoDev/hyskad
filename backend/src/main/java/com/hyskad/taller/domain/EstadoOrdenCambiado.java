package com.hyskad.taller.domain;

/** RN-23: la orden cambió de estado. Lo escuchan las notificaciones y los correos (F10). */
public record EstadoOrdenCambiado(Long ordenId, String numero, EstadoOrden anterior, EstadoOrden nuevo,
        Long usuarioId, String nota) {
}

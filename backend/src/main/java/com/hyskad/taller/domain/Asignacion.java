package com.hyskad.taller.domain;

/** Un mecánico ya validado (usuario activo con rol MECANICO) y su actividad en la orden. */
public record Asignacion(Long mecanicoId, String actividad) {
}

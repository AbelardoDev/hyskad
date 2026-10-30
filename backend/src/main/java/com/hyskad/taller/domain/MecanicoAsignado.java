package com.hyskad.taller.domain;

/** RN-26: un mecánico quedó asignado a una orden. Lo escuchan las notificaciones (F10). */
public record MecanicoAsignado(Long ordenId, String numero, Long mecanicoId, Long asignadoPor) {
}

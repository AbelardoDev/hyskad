package com.hyskad.taller.domain;

/** RN-33: el cliente aprobó o rechazó el presupuesto. Lo escuchan las notificaciones (F10). */
public record PresupuestoDecidido(Long presupuestoId, String numero, Long ordenId, EstadoPresupuesto decision,
        Long decididoPor) {
}

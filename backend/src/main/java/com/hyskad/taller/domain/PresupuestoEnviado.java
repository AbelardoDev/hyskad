package com.hyskad.taller.domain;

import java.math.BigDecimal;

/** RN-31: se envió un presupuesto al cliente. Lo escuchan las notificaciones y el correo (F10). */
public record PresupuestoEnviado(Long presupuestoId, String numero, Long ordenId, Long clienteId, BigDecimal total) {
}

package com.hyskad.taller.domain;

/** La moto se entregó al cliente y la orden quedó cerrada. Lo escuchan las notificaciones (F10). */
public record OrdenEntregada(Long ordenId, String numero, Long clienteId, Long entregadaPor) {
}

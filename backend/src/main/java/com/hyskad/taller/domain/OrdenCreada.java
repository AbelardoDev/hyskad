package com.hyskad.taller.domain;

/** RN-25: se recibió una moto. Lo escuchan las notificaciones y el correo de ingreso (F10). */
public record OrdenCreada(Long ordenId, String numero, Long clienteId, Long motocicletaId, Long creadaPor) {
}

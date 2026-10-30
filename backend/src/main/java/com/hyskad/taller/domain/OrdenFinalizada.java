package com.hyskad.taller.domain;

import java.math.BigDecimal;

/** La orden quedó lista para entregar y su stock reservado salió del inventario. Lo escuchan las notificaciones (F10). */
public record OrdenFinalizada(Long ordenId, String numero, Long clienteId, BigDecimal total) {
}

package com.hyskad.ventas.domain;

import java.math.BigDecimal;

/** RN-21: una venta se anuló y su stock volvió al inventario. Lo escuchan las notificaciones (F10). */
public record VentaAnulada(Long ventaId, String numero, BigDecimal total, Long anuladaPor) {
}

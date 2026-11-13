package com.hyskad.reportes.web.dto;

import java.math.BigDecimal;

import com.hyskad.reportes.application.CuentaPendiente;
import com.hyskad.shared.web.PageResponse;

/** RF26: la página de cuentas pendientes y el total adeudado de todo el resultado filtrado. */
public record CuentasPendientesResponse(PageResponse<CuentaPendiente> cuentas, BigDecimal totalAdeudado) {
}

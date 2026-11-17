package com.hyskad.configuracion.application;

import java.math.BigDecimal;

/** Configuración editable del taller (F11): datos del taller, IVA, privacidad y alerta de stock. */
public record ConfiguracionTaller(String nombre, String nit, String direccion, String telefono, String email,
        BigDecimal ivaPorcentaje, String textoAutorizacionDatos, boolean alertaStockHabilitada) {
}

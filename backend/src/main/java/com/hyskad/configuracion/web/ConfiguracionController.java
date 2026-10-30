package com.hyskad.configuracion.web;

import java.math.BigDecimal;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.hyskad.configuracion.application.ConfiguracionService;

/**
 * Lectura de parámetros que la interfaz necesita para calcular en vivo (la edición llega en F11
 * con {@code CONFIGURACION_GESTIONAR}).
 */
@RestController
@RequestMapping("/api/v1/configuracion")
public class ConfiguracionController {

    private final ConfiguracionService service;

    public ConfiguracionController(ConfiguracionService service) {
        this.service = service;
    }

    /** IVA vigente (RN-03) para mostrar totales antes de guardar; el backend recalcula al registrar. */
    @GetMapping("/iva")
    @PreAuthorize("isAuthenticated()")
    public Iva iva() {
        return new Iva(service.getIvaPorcentaje());
    }

    public record Iva(BigDecimal porcentaje) {
    }
}

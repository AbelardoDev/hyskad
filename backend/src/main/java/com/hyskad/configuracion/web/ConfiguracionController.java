package com.hyskad.configuracion.web;

import java.math.BigDecimal;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.hyskad.configuracion.application.ActualizarConfiguracion;
import com.hyskad.configuracion.application.ConfiguracionService;
import com.hyskad.configuracion.application.ConfiguracionTaller;

import jakarta.validation.Valid;

/**
 * Configuración del taller (F11): la lee y edita quien tiene {@code CONFIGURACION_GESTIONAR}; el IVA
 * y el texto de autorización de datos los lee cualquier usuario autenticado.
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

    /** RN-45: texto que se muestra al registrar un cliente. */
    @GetMapping("/autorizacion-datos")
    @PreAuthorize("isAuthenticated()")
    public TextoAutorizacion autorizacionDatos() {
        return new TextoAutorizacion(service.getTextoAutorizacionDatos());
    }

    @GetMapping
    @PreAuthorize("hasAuthority('CONFIGURACION_GESTIONAR')")
    public ConfiguracionTaller obtener() {
        return service.obtener();
    }

    @PutMapping
    @PreAuthorize("hasAuthority('CONFIGURACION_GESTIONAR')")
    public ConfiguracionTaller actualizar(@Valid @RequestBody ActualizarConfiguracion datos) {
        return service.actualizar(datos);
    }

    public record Iva(BigDecimal porcentaje) {
    }

    public record TextoAutorizacion(String texto) {
    }
}

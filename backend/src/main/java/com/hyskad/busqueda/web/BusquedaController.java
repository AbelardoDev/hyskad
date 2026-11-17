package com.hyskad.busqueda.web;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.hyskad.busqueda.application.BusquedaService;
import com.hyskad.busqueda.application.ResultadoBusqueda;

/** Búsqueda global de la paleta de comandos (RF29): cada tipo según los permisos del usuario. */
@RestController
@RequestMapping("/api/v1/busqueda")
public class BusquedaController {

    private final BusquedaService service;

    public BusquedaController(BusquedaService service) {
        this.service = service;
    }

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public ResultadoBusqueda buscar(@RequestParam(defaultValue = "") String q) {
        return service.buscar(q);
    }
}

package com.hyskad.dashboard.web;

import java.time.LocalDate;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.hyskad.dashboard.application.DashboardService;
import com.hyskad.dashboard.application.DashboardService.Dashboard;

/** Panel de control (RF34): cada bloque según los permisos del usuario. */
@RestController
@RequestMapping("/api/v1/dashboard")
public class DashboardController {

    private final DashboardService service;

    public DashboardController(DashboardService service) {
        this.service = service;
    }

    /** Periodo de las series y los top en días de Bogotá; por defecto, los últimos 30 días. */
    @GetMapping
    @PreAuthorize("hasAuthority('DASHBOARD_VER')")
    public Dashboard panel(@RequestParam(required = false) LocalDate desde,
            @RequestParam(required = false) LocalDate hasta) {
        return service.panel(desde, hasta);
    }
}

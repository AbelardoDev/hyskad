package com.hyskad.reportes.web;

import java.time.LocalDate;

import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.hyskad.reportes.application.ReporteService;
import com.hyskad.reportes.application.ReporteService.CuentasPendientes;
import com.hyskad.reportes.web.dto.CuentasPendientesResponse;
import com.hyskad.shared.web.PageResponse;

@RestController
@RequestMapping("/api/v1/reportes")
public class ReporteController {

    private final ReporteService service;

    public ReporteController(ReporteService service) {
        this.service = service;
    }

    /** RF26: filtros por cliente y por fecha de finalización (días en Bogotá, {@code hasta} inclusivo). */
    @GetMapping("/cuentas-pendientes")
    @PreAuthorize("hasAuthority('REPORTES_VER')")
    public CuentasPendientesResponse cuentasPendientes(@RequestParam(required = false) Long clienteId,
            @RequestParam(required = false) LocalDate desde, @RequestParam(required = false) LocalDate hasta,
            @PageableDefault(size = 20) Pageable pagina) {
        CuentasPendientes resultado = service.cuentasPendientes(clienteId, desde, hasta, pagina);
        return new CuentasPendientesResponse(PageResponse.of(resultado.cuentas()), resultado.totalAdeudado());
    }
}

package com.hyskad.reportes.application;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hyskad.shared.config.TiempoConfig;
import com.hyskad.taller.application.OrdenTrabajoService;
import com.hyskad.taller.application.OrdenTrabajoService.PendientesDePago;
import com.hyskad.taller.domain.OrdenTrabajo;

/** Reportes de solo lectura sobre los demás módulos (RF26; RF32 y RF33 llegan en F11). */
@Service
public class ReporteService {

    private final OrdenTrabajoService ordenes;
    private final Clock clock;

    public ReporteService(OrdenTrabajoService ordenes, Clock clock) {
        this.ordenes = ordenes;
        this.clock = clock;
    }

    /**
     * RF26 y RN-37: órdenes finalizadas sin pago, la más antigua primero (el orden es fijo), con
     * los días de calendario en Bogotá desde la finalización y el total adeudado del resultado.
     */
    @Transactional(readOnly = true)
    public CuentasPendientes cuentasPendientes(Long clienteId, LocalDate desde, LocalDate hasta, Pageable pagina) {
        PendientesDePago pendientes = ordenes.pendientesDePago(clienteId, desde, hasta,
                PageRequest.of(pagina.getPageNumber(), pagina.getPageSize()));
        LocalDate hoy = LocalDate.now(clock.withZone(TiempoConfig.ZONA_NEGOCIO));
        return new CuentasPendientes(pendientes.ordenes().map(o -> cuenta(o, hoy)), pendientes.totalAdeudado());
    }

    private static CuentaPendiente cuenta(OrdenTrabajo o, LocalDate hoy) {
        LocalDate finalizada = o.getFechaFinalizacion().atZone(TiempoConfig.ZONA_NEGOCIO).toLocalDate();
        return new CuentaPendiente(o.getId(), o.getNumero(), o.getCliente().getId(), o.getCliente().getNombreCompleto(),
                o.getCliente().getTelefono(), o.getMotocicleta().getPlaca(),
                o.getMotocicleta().getMarca() + " " + o.getMotocicleta().getModelo(), o.getFechaFinalizacion(),
                ChronoUnit.DAYS.between(finalizada, hoy), o.getTotal());
    }

    /** Una página de cuentas y el total adeudado de todas las que cumplen el filtro. */
    public record CuentasPendientes(Page<CuentaPendiente> cuentas, BigDecimal totalAdeudado) {
    }
}

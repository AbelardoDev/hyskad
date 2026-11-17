package com.hyskad.dashboard.application;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hyskad.inventario.application.EstadisticasInventario;
import com.hyskad.shared.config.TiempoConfig;
import com.hyskad.shared.error.BusinessException;
import com.hyskad.shared.error.ErrorCode;
import com.hyskad.shared.security.UsuarioActual;
import com.hyskad.taller.application.EstadisticasTaller;
import com.hyskad.taller.application.OrdenTrabajoService;
import com.hyskad.taller.domain.EstadoOrden;
import com.hyskad.usuarios.domain.Permiso;
import com.hyskad.ventas.application.EstadisticasVentas;

/**
 * Panel de control (RF34). Cada bloque sale solo si el usuario puede ver esos datos (un bloque sin
 * permiso viaja en {@code null} o vacío). Quien solo ve sus órdenes asignadas (el mecánico) recibe
 * la vista propia: sus órdenes por estado y las que finalizó en el mes. Los "hoy" y las series son
 * días de Bogotá (RN-53); el periodo por defecto son los últimos 30 días.
 */
@Service
public class DashboardService {

    static final int DIAS_POR_DEFECTO = 30;
    static final int TOP = 5;

    private final EstadisticasTaller taller;
    private final EstadisticasVentas ventas;
    private final EstadisticasInventario inventario;
    private final OrdenTrabajoService ordenes;
    private final UsuarioActual usuarioActual;
    private final Clock clock;

    public DashboardService(EstadisticasTaller taller, EstadisticasVentas ventas, EstadisticasInventario inventario,
            OrdenTrabajoService ordenes, UsuarioActual usuarioActual, Clock clock) {
        this.taller = taller;
        this.ventas = ventas;
        this.inventario = inventario;
        this.ordenes = ordenes;
        this.usuarioActual = usuarioActual;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public Dashboard panel(LocalDate desde, LocalDate hasta) {
        LocalDate hoy = LocalDate.now(clock.withZone(TiempoConfig.ZONA_NEGOCIO));
        LocalDate fin = hasta == null ? hoy : hasta;
        LocalDate inicio = desde == null ? fin.minusDays(DIAS_POR_DEFECTO - 1) : desde;
        if (inicio.isAfter(fin) || inicio.plusYears(1).isBefore(fin)) {
            throw new BusinessException(ErrorCode.PARAMETRO_INVALIDO, "Periodo inválido",
                    Map.of("desde", inicio.toString(), "hasta", fin.toString()));
        }
        boolean todas = puede(Permiso.ORDENES_VER_TODAS);
        boolean asignadas = puede(Permiso.ORDENES_VER_ASIGNADAS);
        boolean verVentas = puede(Permiso.VENTAS_VER);
        boolean verProductos = puede(Permiso.PRODUCTOS_VER);
        boolean mecanico = asignadas && !todas;

        Map<EstadoOrden, Long> porEstado = todas || asignadas ? ordenes.resumenEstados() : Map.of();
        Long activas = porEstado.isEmpty() ? null
                : porEstado.entrySet().stream().filter(e -> !e.getKey().esFinal()).mapToLong(Map.Entry::getValue).sum();

        var resumenHoy = verVentas ? ventas.resumen(hoy, hoy) : null;
        Kpis kpis = new Kpis(
                resumenHoy == null ? null : resumenHoy.cantidad(),
                resumenHoy == null ? null : resumenHoy.total(),
                todas ? taller.ingresosEntregadas(hoy, hoy) : null,
                activas,
                // El mecánico solo ve sus órdenes por estado y sus finalizadas del mes (F11)
                porEstado.isEmpty() || mecanico ? null
                        : porEstado.getOrDefault(EstadoOrden.PENDIENTE_APROBACION, 0L),
                todas ? taller.porCobrar() : null,
                verProductos && !mecanico ? inventario.conStockBajo() : null,
                mecanico ? taller.finalizadasDelMecanico(usuarioActual.idRequerido(), hoy.withDayOfMonth(1), hoy)
                        : null);

        return new Dashboard(mecanico ? Vista.MECANICO : Vista.GENERAL, inicio, fin, kpis,
                mecanico ? List.of() : ingresosDiarios(inicio, fin, verVentas, todas), porEstado,
                todas ? taller.topServicios(inicio, fin, TOP).stream()
                        .map(s -> new Top(s.nombre(), BigDecimal.valueOf(s.cantidad()), s.ingresos())).toList()
                        : List.of(),
                verProductos && !mecanico ? inventario.masUsados(inicio, fin, TOP).stream()
                        .map(u -> new Top(u.codigo() + " · " + u.nombre(), u.cantidad(), null)).toList() : List.of(),
                todas || asignadas ? taller.ultimasActualizadas(TOP).stream()
                        .map(o -> new OrdenReciente(o.getId(), o.getNumero(), o.getEstado(), o.getMotocicleta().getPlaca(),
                                o.getMotocicleta().getMarca() + " " + o.getMotocicleta().getModelo(),
                                o.getCliente().getNombreCompleto(), o.getUpdatedAt()))
                        .toList() : List.of(),
                verProductos && !mecanico ? inventario.stockCritico(TOP) : List.of());
    }

    /** Ingresos por día del periodo (ventas pagadas + órdenes entregadas), con los días sin movimiento en 0. */
    private List<IngresoDia> ingresosDiarios(LocalDate inicio, LocalDate fin, boolean verVentas, boolean verOrdenes) {
        if (!verVentas && !verOrdenes) {
            return List.of();
        }
        Map<LocalDate, BigDecimal> porVentas = verVentas ? ventas.totalPorDia(inicio, fin) : Map.of();
        Map<LocalDate, BigDecimal> porOrdenes = verOrdenes ? taller.ingresosEntregadasPorDia(inicio, fin) : Map.of();
        List<IngresoDia> dias = new ArrayList<>();
        for (LocalDate dia = inicio; !dia.isAfter(fin); dia = dia.plusDays(1)) {
            dias.add(new IngresoDia(dia, porVentas.getOrDefault(dia, BigDecimal.ZERO),
                    porOrdenes.getOrDefault(dia, BigDecimal.ZERO)));
        }
        return dias;
    }

    private boolean puede(Permiso permiso) {
        return usuarioActual.tienePermiso(permiso.name());
    }

    public enum Vista {
        GENERAL, MECANICO
    }

    /** Indicadores; {@code null} si el usuario no puede ver ese dato. */
    public record Kpis(Long ventasHoyCantidad, BigDecimal ventasHoyTotal, BigDecimal ingresosOrdenesHoy,
            Long ordenesActivas, Long pendientesAprobacion, BigDecimal porCobrar, Long productosStockBajo,
            Long finalizadasMes) {
    }

    public record IngresoDia(LocalDate dia, BigDecimal ventas, BigDecimal ordenes) {
    }

    public record Top(String nombre, BigDecimal cantidad, BigDecimal ingresos) {
    }

    public record OrdenReciente(Long id, String numero, EstadoOrden estado, String placa, String moto, String cliente,
            Instant actualizada) {
    }

    public record Dashboard(Vista vista, LocalDate desde, LocalDate hasta, Kpis kpis, List<IngresoDia> ingresosDiarios,
            Map<EstadoOrden, Long> ordenesPorEstado, List<Top> topServicios, List<Top> topRepuestos,
            List<OrdenReciente> ultimasOrdenes, List<EstadisticasInventario.ProductoCritico> stockCritico) {
    }
}

package com.hyskad.taller.application;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hyskad.shared.config.TiempoConfig;
import com.hyskad.taller.domain.OrdenTrabajo;
import com.hyskad.taller.persistence.EstadisticasTallerRepository;
import com.hyskad.taller.persistence.EstadisticasTallerRepository.FilaOrden;
import com.hyskad.taller.persistence.OrdenTrabajoRepository;

/**
 * Estadísticas de solo lectura del taller para reportes (RF32) y dashboard (RF34). Los rangos son
 * días de Bogotá con {@code hasta} inclusivo (RN-53).
 */
@Service
public class EstadisticasTaller {

    private final EstadisticasTallerRepository estadisticas;
    private final OrdenTrabajoRepository ordenes;
    private final OrdenTrabajoService servicio;

    public EstadisticasTaller(EstadisticasTallerRepository estadisticas, OrdenTrabajoRepository ordenes,
            OrdenTrabajoService servicio) {
        this.estadisticas = estadisticas;
        this.ordenes = ordenes;
        this.servicio = servicio;
    }

    /**
     * RF32: órdenes realizadas (finalizadas o entregadas) en el rango, filtrables por servicio del
     * catálogo y por mecánico. Con un servicio, la mano de obra y la cantidad son solo de ese servicio.
     */
    @Transactional(readOnly = true)
    public ReporteServicios reporteServicios(LocalDate desde, LocalDate hasta, Long servicioId, Long mecanicoId) {
        Instant inicio = inicio(desde);
        Instant fin = finExclusivo(hasta);
        List<FilaOrden> filas = estadisticas.ordenesRealizadas(inicio, fin, servicioId, mecanicoId);
        long servicios = filas.stream().mapToLong(FilaOrden::servicios).sum();
        BigDecimal manoObra = suma(filas.stream().map(FilaOrden::manoObra).toList());
        BigDecimal repuestos = suma(filas.stream().map(FilaOrden::repuestos).toList());
        BigDecimal horasPromedio = filas.isEmpty() ? BigDecimal.ZERO
                : BigDecimal.valueOf(filas.stream().mapToLong(FilaOrden::minutos).sum())
                        .divide(BigDecimal.valueOf(60L * filas.size()), 1, RoundingMode.HALF_UP);
        return new ReporteServicios(filas.size(), servicios, manoObra, repuestos, horasPromedio,
                estadisticas.serviciosRealizados(inicio, fin, servicioId, mecanicoId, 50).stream()
                        .map(s -> new ReporteServicios.PorServicio(s.nombre(), s.cantidad(), s.ingresos())).toList(),
                filas.stream().map(f -> new ReporteServicios.Detalle(f.id(), f.numero(), f.fechaFinalizacion(),
                        f.placa(), f.cliente(), f.mecanicos(), f.servicios(), f.manoObra(), f.repuestos(), f.total(),
                        BigDecimal.valueOf(f.minutos()).divide(BigDecimal.valueOf(60), 1, RoundingMode.HALF_UP)))
                        .toList());
    }

    /** RF34: los servicios más realizados en el rango. */
    @Transactional(readOnly = true)
    public List<ReporteServicios.PorServicio> topServicios(LocalDate desde, LocalDate hasta, int limite) {
        return estadisticas.serviciosRealizados(inicio(desde), finExclusivo(hasta), null, null, limite).stream()
                .map(s -> new ReporteServicios.PorServicio(s.nombre(), s.cantidad(), s.ingresos())).toList();
    }

    @Transactional(readOnly = true)
    public BigDecimal ingresosEntregadas(LocalDate desde, LocalDate hasta) {
        return estadisticas.totalEntregadas(inicio(desde), finExclusivo(hasta));
    }

    @Transactional(readOnly = true)
    public Map<LocalDate, BigDecimal> ingresosEntregadasPorDia(LocalDate desde, LocalDate hasta) {
        return estadisticas.entregadasPorDia(inicio(desde), finExclusivo(hasta));
    }

    /** RN-37: total que se debe por órdenes finalizadas sin pago. */
    @Transactional(readOnly = true)
    public BigDecimal porCobrar() {
        return ordenes.totalPendienteDePago(null, null, null);
    }

    @Transactional(readOnly = true)
    public long finalizadasDelMecanico(Long mecanicoId, LocalDate desde, LocalDate hasta) {
        return estadisticas.finalizadasDelMecanico(mecanicoId, inicio(desde), finExclusivo(hasta));
    }

    /** Las órdenes visibles para el usuario modificadas más recientemente (RN-27). */
    @Transactional(readOnly = true)
    public List<OrdenTrabajo> ultimasActualizadas(int limite) {
        return servicio.listar(new FiltroOrdenes(null, null, null, null, null),
                PageRequest.of(0, limite, Sort.by(Sort.Order.desc("updatedAt"), Sort.Order.desc("id")))).getContent();
    }

    private static Instant inicio(LocalDate dia) {
        return dia.atStartOfDay(TiempoConfig.ZONA_NEGOCIO).toInstant();
    }

    private static Instant finExclusivo(LocalDate dia) {
        return dia.plusDays(1).atStartOfDay(TiempoConfig.ZONA_NEGOCIO).toInstant();
    }

    private static BigDecimal suma(List<BigDecimal> valores) {
        return valores.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    /** RF32: resumen, servicios agrupados y detalle por orden. Montos sin IVA ni descuento salvo {@code total}. */
    public record ReporteServicios(long ordenes, long servicios, BigDecimal ingresosManoObra,
            BigDecimal ingresosRepuestos, BigDecimal horasPromedioEnTaller, List<PorServicio> porServicio,
            List<Detalle> detalle) {

        public record PorServicio(String nombre, long cantidad, BigDecimal ingresos) {
        }

        public record Detalle(Long ordenId, String numero, Instant fechaFinalizacion, String placa, String cliente,
                String mecanicos, long servicios, BigDecimal manoObra, BigDecimal repuestos, BigDecimal total,
                BigDecimal horasEnTaller) {
        }
    }
}

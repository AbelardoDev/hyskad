package com.hyskad.ventas.application;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hyskad.shared.config.TiempoConfig;
import com.hyskad.shared.dinero.MetodoPago;
import com.hyskad.ventas.persistence.EstadisticasVentasRepository;
import com.hyskad.ventas.persistence.EstadisticasVentasRepository.FilaVenta;

/**
 * Estadísticas de solo lectura de ventas pagadas: reporte de ventas con utilidad bruta (precio menos
 * costo congelado, RN-09) y datos del dashboard (RF34). Días de Bogotá con {@code hasta} inclusivo.
 */
@Service
public class EstadisticasVentas {

    private final EstadisticasVentasRepository estadisticas;

    public EstadisticasVentas(EstadisticasVentasRepository estadisticas) {
        this.estadisticas = estadisticas;
    }

    /** Utilidad bruta = subtotal − descuento − costo congelado de lo vendido. */
    @Transactional(readOnly = true)
    public ReporteVentas reporteVentas(LocalDate desde, LocalDate hasta, Long vendedorId, MetodoPago metodo) {
        List<FilaVenta> filas = estadisticas.ventas(inicio(desde), finExclusivo(hasta), vendedorId,
                metodo == null ? null : metodo.name());
        BigDecimal subtotal = suma(filas, FilaVenta::subtotal);
        BigDecimal descuento = suma(filas, FilaVenta::descuento);
        BigDecimal costo = suma(filas, FilaVenta::costo);
        BigDecimal base = subtotal.subtract(descuento);
        BigDecimal utilidad = base.subtract(costo);
        BigDecimal margen = base.signum() == 0 ? BigDecimal.ZERO
                : utilidad.multiply(BigDecimal.valueOf(100)).divide(base, 1, RoundingMode.HALF_UP);
        Map<LocalDate, BigDecimal> porDia = filas.stream().collect(Collectors.groupingBy(
                f -> f.fecha().atZone(TiempoConfig.ZONA_NEGOCIO).toLocalDate(), TreeMap::new,
                Collectors.reducing(BigDecimal.ZERO, FilaVenta::total, BigDecimal::add)));
        Map<String, BigDecimal> porMetodo = filas.stream().collect(Collectors.groupingBy(FilaVenta::metodo,
                TreeMap::new, Collectors.reducing(BigDecimal.ZERO, FilaVenta::total, BigDecimal::add)));
        return new ReporteVentas(filas.size(), subtotal, descuento, suma(filas, FilaVenta::impuesto),
                suma(filas, FilaVenta::total), costo, utilidad, margen,
                porDia.entrySet().stream().map(e -> new ReporteVentas.Valor(e.getKey().toString(), e.getValue()))
                        .toList(),
                porMetodo.entrySet().stream().map(e -> new ReporteVentas.Valor(e.getKey(), e.getValue())).toList(),
                filas.stream().map(f -> new ReporteVentas.Detalle(f.id(), f.numero(), f.fecha(), f.vendedor(),
                        f.metodo(), f.total(), f.costo(), f.subtotal().subtract(f.descuento()).subtract(f.costo())))
                        .toList());
    }

    /** Cantidad y total de las ventas pagadas del periodo. */
    @Transactional(readOnly = true)
    public Resumen resumen(LocalDate desde, LocalDate hasta) {
        EstadisticasVentasRepository.Resumen r = estadisticas.resumen(inicio(desde), finExclusivo(hasta));
        return new Resumen(r.cantidad(), r.total());
    }

    /** RN-53: total vendido por día de Bogotá. */
    @Transactional(readOnly = true)
    public Map<LocalDate, BigDecimal> totalPorDia(LocalDate desde, LocalDate hasta) {
        return estadisticas.totalPorDia(inicio(desde), finExclusivo(hasta));
    }

    private static Instant inicio(LocalDate dia) {
        return dia.atStartOfDay(TiempoConfig.ZONA_NEGOCIO).toInstant();
    }

    private static Instant finExclusivo(LocalDate dia) {
        return dia.plusDays(1).atStartOfDay(TiempoConfig.ZONA_NEGOCIO).toInstant();
    }

    private static BigDecimal suma(List<FilaVenta> filas, Function<FilaVenta, BigDecimal> campo) {
        return filas.stream().map(campo).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    public record Resumen(long cantidad, BigDecimal total) {
    }

    /** Reporte de ventas: resumen, series por día y por método, y detalle por venta. */
    public record ReporteVentas(long ventas, BigDecimal subtotal, BigDecimal descuento, BigDecimal impuesto,
            BigDecimal total, BigDecimal costo, BigDecimal utilidadBruta, BigDecimal margenPorcentaje,
            List<Valor> porDia, List<Valor> porMetodo, List<Detalle> detalle) {

        public record Valor(String clave, BigDecimal valor) {
        }

        public record Detalle(Long ventaId, String numero, Instant fecha, String vendedor, String metodo,
                BigDecimal total, BigDecimal costo, BigDecimal utilidad) {
        }
    }
}

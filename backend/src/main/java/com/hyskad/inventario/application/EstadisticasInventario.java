package com.hyskad.inventario.application;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hyskad.inventario.persistence.EstadisticasInventarioRepository;
import com.hyskad.inventario.persistence.EstadisticasInventarioRepository.FilaProducto;
import com.hyskad.shared.config.TiempoConfig;

/**
 * Estadísticas de solo lectura del inventario: reporte de existencias y valorización (RF33) y datos
 * del dashboard (RF34). Agotado: disponible ≤ 0; bajo: 0 < disponible ≤ mínimo (RN-14).
 */
@Service
public class EstadisticasInventario {

    private final EstadisticasInventarioRepository estadisticas;

    public EstadisticasInventario(EstadisticasInventarioRepository estadisticas) {
        this.estadisticas = estadisticas;
    }

    /** RF33: existencias valorizadas a costo promedio y movimientos del periodo por tipo. */
    @Transactional(readOnly = true)
    public ReporteInventario reporteInventario(LocalDate desde, LocalDate hasta, Long categoriaId) {
        List<FilaProducto> filas = estadisticas.productos(categoriaId);
        List<ReporteInventario.Producto> productos = filas.stream().map(EstadisticasInventario::producto).toList();
        BigDecimal unidades = filas.stream().map(FilaProducto::stockActual).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal valor = productos.stream().map(ReporteInventario.Producto::valor).reduce(BigDecimal.ZERO,
                BigDecimal::add);
        long agotados = productos.stream().filter(p -> p.nivel() == Nivel.AGOTADO).count();
        long bajos = productos.stream().filter(p -> p.nivel() == Nivel.BAJO).count();
        return new ReporteInventario(productos.size(), unidades, valor, bajos, agotados, productos,
                estadisticas.movimientosPorTipo(desde.atStartOfDay(TiempoConfig.ZONA_NEGOCIO).toInstant(),
                        hasta.plusDays(1).atStartOfDay(TiempoConfig.ZONA_NEGOCIO).toInstant()).stream()
                        .map(m -> new ReporteInventario.Movimientos(m.tipo(), m.cantidad(), m.unidades(), m.valor()))
                        .toList());
    }

    @Transactional(readOnly = true)
    public long conStockBajo() {
        return estadisticas.conStockBajo();
    }

    /** Los productos con stock más crítico (sin costos: los ve cualquiera con el dashboard). */
    @Transactional(readOnly = true)
    public List<ProductoCritico> stockCritico(int limite) {
        return estadisticas.stockCritico(limite).stream().map(f -> new ProductoCritico(f.id(), f.codigo(), f.nombre(),
                f.unidad(), f.disponible(), f.stockMinimo())).toList();
    }

    /** Repuestos más usados en el rango (ventas y órdenes, sin las ventas anuladas). */
    @Transactional(readOnly = true)
    public List<Uso> masUsados(LocalDate desde, LocalDate hasta, int limite) {
        return estadisticas.masUsados(desde.atStartOfDay(TiempoConfig.ZONA_NEGOCIO).toInstant(),
                hasta.plusDays(1).atStartOfDay(TiempoConfig.ZONA_NEGOCIO).toInstant(), limite).stream()
                .map(u -> new Uso(u.id(), u.codigo(), u.nombre(), u.cantidad())).toList();
    }

    private static ReporteInventario.Producto producto(FilaProducto f) {
        BigDecimal disponible = f.disponible();
        Nivel nivel = disponible.signum() <= 0 ? Nivel.AGOTADO
                : disponible.compareTo(f.stockMinimo()) <= 0 ? Nivel.BAJO : Nivel.NORMAL;
        return new ReporteInventario.Producto(f.id(), f.codigo(), f.nombre(), f.categoria(), f.unidad(),
                f.stockActual(), disponible, f.stockMinimo(), f.costoPromedio(),
                f.stockActual().multiply(f.costoPromedio()).setScale(2, RoundingMode.HALF_UP), nivel);
    }

    public enum Nivel {
        NORMAL, BAJO, AGOTADO
    }

    public record ProductoCritico(Long id, String codigo, String nombre, String unidad, BigDecimal disponible,
            BigDecimal minimo) {
    }

    public record Uso(Long id, String codigo, String nombre, BigDecimal cantidad) {
    }

    /** RF33: resumen, productos con su nivel y valor, y movimientos del periodo por tipo. */
    public record ReporteInventario(long productos, BigDecimal unidades, BigDecimal valorInventario,
            long conStockBajo, long agotados, List<Producto> detalle, List<Movimientos> movimientos) {

        public record Producto(Long id, String codigo, String nombre, String categoria, String unidad,
                BigDecimal stockActual, BigDecimal disponible, BigDecimal minimo, BigDecimal costoPromedio,
                BigDecimal valor, Nivel nivel) {
        }

        public record Movimientos(String tipo, long cantidad, BigDecimal unidades, BigDecimal valor) {
        }
    }
}

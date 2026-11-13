package com.hyskad.reportes.web;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.hyskad.inventario.application.EstadisticasInventario;
import com.hyskad.inventario.application.EstadisticasInventario.ReporteInventario;
import com.hyskad.reportes.application.ReporteService;
import com.hyskad.reportes.application.ReporteService.CuentasPendientes;
import com.hyskad.reportes.application.ReporteService.Periodo;
import com.hyskad.reportes.web.dto.CuentasPendientesResponse;
import com.hyskad.shared.config.TiempoConfig;
import com.hyskad.shared.dinero.MetodoPago;
import com.hyskad.shared.web.Csv;
import com.hyskad.shared.web.PageResponse;
import com.hyskad.taller.application.EstadisticasTaller;
import com.hyskad.taller.application.EstadisticasTaller.ReporteServicios;
import com.hyskad.ventas.application.EstadisticasVentas;
import com.hyskad.ventas.application.EstadisticasVentas.ReporteVentas;

/**
 * Reportes (RF26, RF32, RF33). Se exige {@code REPORTES_VER} más el permiso del área de cada
 * reporte (decisión de F11): servicios con {@code PRESUPUESTOS_GESTIONAR}, inventario con costos con
 * {@code PRODUCTOS_GESTIONAR}, ventas con utilidad con {@code VENTAS_ANULAR} y cuentas pendientes con
 * {@code PAGOS_REGISTRAR}. Con {@code ?formato=csv} se descargan para Excel (UTF-8 con BOM, {@code ;}).
 */
@RestController
@RequestMapping("/api/v1/reportes")
public class ReporteController {

    private static final DateTimeFormatter FECHA = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")
            .withZone(TiempoConfig.ZONA_NEGOCIO);

    private final ReporteService service;
    private final EstadisticasTaller taller;
    private final EstadisticasInventario inventario;
    private final EstadisticasVentas ventas;

    public ReporteController(ReporteService service, EstadisticasTaller taller, EstadisticasInventario inventario,
            EstadisticasVentas ventas) {
        this.service = service;
        this.taller = taller;
        this.inventario = inventario;
        this.ventas = ventas;
    }

    /** RF26: filtros por cliente y por fecha de finalización (días en Bogotá, {@code hasta} inclusivo). */
    @GetMapping("/cuentas-pendientes")
    @PreAuthorize("hasAuthority('REPORTES_VER') and hasAuthority('PAGOS_REGISTRAR')")
    public CuentasPendientesResponse cuentasPendientes(@RequestParam(required = false) Long clienteId,
            @RequestParam(required = false) LocalDate desde, @RequestParam(required = false) LocalDate hasta,
            @PageableDefault(size = 20) Pageable pagina) {
        CuentasPendientes resultado = service.cuentasPendientes(clienteId, desde, hasta, pagina);
        return new CuentasPendientesResponse(PageResponse.of(resultado.cuentas()), resultado.totalAdeudado());
    }

    /** RF32: órdenes realizadas en el periodo, por servicio del catálogo y por mecánico. */
    @GetMapping("/servicios")
    @PreAuthorize("hasAuthority('REPORTES_VER') and hasAuthority('PRESUPUESTOS_GESTIONAR')")
    public ResponseEntity<?> servicios(@RequestParam(required = false) LocalDate desde,
            @RequestParam(required = false) LocalDate hasta, @RequestParam(required = false) Long servicioId,
            @RequestParam(required = false) Long mecanicoId, @RequestParam(required = false) String formato) {
        Periodo p = service.periodo(desde, hasta);
        ReporteServicios r = taller.reporteServicios(p.desde(), p.hasta(), servicioId, mecanicoId);
        if (!esCsv(formato)) {
            return ResponseEntity.ok(r);
        }
        Csv csv = Csv.con("orden", "fecha_finalizacion", "placa", "cliente", "mecanicos", "servicios", "mano_obra",
                "repuestos", "total", "horas_en_taller");
        r.detalle().forEach(d -> csv.fila(Csv.texto(d.numero()), FECHA.format(d.fechaFinalizacion()),
                Csv.texto(d.placa()), Csv.texto(d.cliente()), Csv.texto(d.mecanicos()), Csv.numero(d.servicios()),
                Csv.numero(d.manoObra()), Csv.numero(d.repuestos()), Csv.numero(d.total()),
                Csv.numero(d.horasEnTaller())));
        return csv.descarga(archivo("servicios", p));
    }

    /** RF33: existencias valorizadas a costo promedio y movimientos del periodo por tipo. */
    @GetMapping("/inventario")
    @PreAuthorize("hasAuthority('REPORTES_VER') and hasAuthority('PRODUCTOS_GESTIONAR')")
    public ResponseEntity<?> inventario(@RequestParam(required = false) LocalDate desde,
            @RequestParam(required = false) LocalDate hasta, @RequestParam(required = false) Long categoriaId,
            @RequestParam(required = false) String formato) {
        Periodo p = service.periodo(desde, hasta);
        ReporteInventario r = inventario.reporteInventario(p.desde(), p.hasta(), categoriaId);
        if (!esCsv(formato)) {
            return ResponseEntity.ok(r);
        }
        Csv csv = Csv.con("codigo", "producto", "categoria", "unidad", "existencias", "disponible", "minimo",
                "costo_promedio", "valor", "nivel");
        r.detalle().forEach(d -> csv.fila(Csv.texto(d.codigo()), Csv.texto(d.nombre()), Csv.texto(d.categoria()),
                d.unidad(), Csv.numero(d.stockActual()), Csv.numero(d.disponible()), Csv.numero(d.minimo()),
                Csv.numero(d.costoPromedio()), Csv.numero(d.valor()), d.nivel().name()));
        return csv.descarga(archivo("inventario", p));
    }

    /** Ventas pagadas del periodo con utilidad bruta (precio menos costo congelado). */
    @GetMapping("/ventas")
    @PreAuthorize("hasAuthority('REPORTES_VER') and hasAuthority('VENTAS_ANULAR')")
    public ResponseEntity<?> ventas(@RequestParam(required = false) LocalDate desde,
            @RequestParam(required = false) LocalDate hasta, @RequestParam(required = false) Long vendedorId,
            @RequestParam(required = false) MetodoPago metodo, @RequestParam(required = false) String formato) {
        Periodo p = service.periodo(desde, hasta);
        ReporteVentas r = ventas.reporteVentas(p.desde(), p.hasta(), vendedorId, metodo);
        if (!esCsv(formato)) {
            return ResponseEntity.ok(r);
        }
        Csv csv = Csv.con("venta", "fecha", "vendedor", "metodo", "total", "costo", "utilidad");
        r.detalle().forEach(d -> csv.fila(Csv.texto(d.numero()), FECHA.format(d.fecha()), Csv.texto(d.vendedor()),
                d.metodo(), Csv.numero(d.total()), Csv.numero(d.costo()), Csv.numero(d.utilidad())));
        return csv.descarga(archivo("ventas", p));
    }

    private static boolean esCsv(String formato) {
        return "csv".equalsIgnoreCase(formato);
    }

    private static String archivo(String reporte, Periodo p) {
        return "reporte-" + reporte + "-" + p.desde() + "-a-" + p.hasta() + ".csv";
    }
}

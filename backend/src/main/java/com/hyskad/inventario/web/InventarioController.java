package com.hyskad.inventario.web;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Instant;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.data.web.SortDefault;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import com.hyskad.inventario.application.AjustarInventario;
import com.hyskad.inventario.application.FiltroMovimientos;
import com.hyskad.inventario.application.InventarioService;
import com.hyskad.inventario.domain.MovimientoInventario;
import com.hyskad.inventario.domain.TipoMovimiento;
import com.hyskad.inventario.web.dto.MovimientoResponse;
import com.hyskad.shared.web.PageResponse;

import jakarta.validation.Valid;

/**
 * Movimientos y ajustes de inventario (RF18). Los movimientos (con costos) los consultan quienes
 * gestionan productos o ajustan inventario; los ajustes exigen {@code INVENTARIO_AJUSTAR} (RN-13).
 */
@RestController
@RequestMapping("/api/v1/inventario")
public class InventarioController {

    private static final String PUEDE_VER_MOVIMIENTOS = "hasAnyAuthority('PRODUCTOS_GESTIONAR', 'INVENTARIO_AJUSTAR')";

    private final InventarioService service;
    private final MovimientosWeb web;

    public InventarioController(InventarioService service, MovimientosWeb web) {
        this.service = service;
        this.web = web;
    }

    /** {@code desde} incluido y {@code hasta} excluido, en ISO-8601 UTC. */
    @GetMapping("/movimientos")
    @PreAuthorize(PUEDE_VER_MOVIMIENTOS)
    public PageResponse<MovimientoResponse> movimientos(@RequestParam(required = false) Long productoId,
            @RequestParam(required = false) TipoMovimiento tipo, @RequestParam(required = false) Instant desde,
            @RequestParam(required = false) Instant hasta, @RequestParam(required = false) Long usuarioId,
            @PageableDefault(size = 20) @SortDefault(sort = { "fecha", "id" }, direction = Sort.Direction.DESC)
            Pageable pagina) {
        Page<MovimientoInventario> resultado = service.movimientos(
                new FiltroMovimientos(productoId, tipo, desde, hasta, usuarioId), pagina);
        return new PageResponse<>(web.respuestas(resultado.getContent()), resultado.getNumber(), resultado.getSize(),
                resultado.getTotalElements(), resultado.getTotalPages());
    }

    /** Los mismos filtros en CSV (máximo 10 000 filas, las más recientes). */
    @GetMapping("/movimientos/exportar")
    @PreAuthorize(PUEDE_VER_MOVIMIENTOS)
    public ResponseEntity<byte[]> exportar(@RequestParam(required = false) Long productoId,
            @RequestParam(required = false) TipoMovimiento tipo, @RequestParam(required = false) Instant desde,
            @RequestParam(required = false) Instant hasta, @RequestParam(required = false) Long usuarioId) {
        byte[] csv = web.csv(service.movimientosParaExportar(
                new FiltroMovimientos(productoId, tipo, desde, hasta, usuarioId)));
        return ResponseEntity.ok()
                .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename("movimientos-inventario.csv").build().toString())
                .body(csv);
    }

    @PostMapping("/ajustes")
    @PreAuthorize("hasAuthority('INVENTARIO_AJUSTAR')")
    public ResponseEntity<MovimientoResponse> ajustar(@Valid @RequestBody AjustarInventario datos) {
        MovimientoResponse movimiento = web.respuesta(service.ajustar(datos));
        URI ubicacion = ServletUriComponentsBuilder.fromCurrentContextPath()
                .path("/api/v1/inventario/movimientos").queryParam("productoId", datos.productoId()).build().toUri();
        return ResponseEntity.created(ubicacion).body(movimiento);
    }
}

package com.hyskad.taller.web;

import java.net.URI;
import java.time.LocalDate;
import java.util.Map;
import java.util.Set;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.data.web.SortDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import com.hyskad.shared.web.PageResponse;
import com.hyskad.taller.application.ActualizarRecepcion;
import com.hyskad.taller.application.AsignarMecanicos;
import com.hyskad.taller.application.CrearOrden;
import com.hyskad.taller.application.FiltroOrdenes;
import com.hyskad.taller.application.OrdenTrabajoService;
import com.hyskad.taller.application.OrdenTrabajoService.InfoRecepcion;
import com.hyskad.taller.application.RegistrarDiagnostico;
import com.hyskad.taller.application.SolicitarTransicion;
import com.hyskad.taller.domain.EstadoOrden;
import com.hyskad.taller.domain.OrdenTrabajo;
import com.hyskad.taller.web.dto.OrdenResponse;
import com.hyskad.taller.web.dto.OrdenResumenResponse;

import jakarta.validation.Valid;

/**
 * Órdenes de trabajo (RF10–RF14). Consultar con {@code ORDENES_VER_TODAS} o, solo las asignadas,
 * con {@code ORDENES_VER_ASIGNADAS} (RN-27); recibir y editar con {@code ORDENES_CREAR}, asignar con
 * {@code ORDENES_ASIGNAR} y diagnosticar con {@code ORDENES_TRABAJAR}. El permiso de cada
 * transición depende de la transición y lo verifica el servicio. Las modificaciones devuelven el
 * detalle actualizado (con la nueva {@code version}).
 */
@RestController
@RequestMapping("/api/v1/ordenes-trabajo")
public class OrdenTrabajoController {

    private static final String VER = "hasAnyAuthority('ORDENES_VER_TODAS', 'ORDENES_VER_ASIGNADAS')";

    private final OrdenTrabajoService service;
    private final OrdenesWeb web;

    public OrdenTrabajoController(OrdenTrabajoService service, OrdenesWeb web) {
        this.service = service;
        this.web = web;
    }

    /** {@code q}: número, placa o cliente. {@code desde} y {@code hasta}: días de ingreso, inclusivos. */
    @GetMapping
    @PreAuthorize(VER)
    public PageResponse<OrdenResumenResponse> listar(@RequestParam(required = false) String q,
            @RequestParam(required = false) Set<EstadoOrden> estado, @RequestParam(required = false) Long mecanicoId,
            @RequestParam(required = false) LocalDate desde, @RequestParam(required = false) LocalDate hasta,
            @PageableDefault(size = 20) @SortDefault(sort = { "fechaIngreso", "id" }, direction = Sort.Direction.DESC)
            Pageable pagina) {
        return pagina(service.listar(new FiltroOrdenes(q, estado, mecanicoId, desde, hasta), pagina));
    }

    @GetMapping("/mias")
    @PreAuthorize("hasAuthority('ORDENES_VER_ASIGNADAS')")
    public PageResponse<OrdenResumenResponse> mias(@RequestParam(required = false) String q,
            @RequestParam(required = false) Set<EstadoOrden> estado,
            @PageableDefault(size = 20) @SortDefault(sort = { "fechaIngreso", "id" }, direction = Sort.Direction.DESC)
            Pageable pagina) {
        return pagina(service.mias(new FiltroOrdenes(q, estado, null, null, null), pagina));
    }

    /** Cuántas órdenes visibles hay en cada estado (contadores del tablero). */
    @GetMapping("/resumen-estados")
    @PreAuthorize(VER)
    public Map<EstadoOrden, Long> resumenEstados() {
        return service.resumenEstados();
    }

    /** Última lectura de kilometraje de la moto y su orden activa, para la recepción. */
    @GetMapping("/recepcion")
    @PreAuthorize("hasAuthority('ORDENES_CREAR')")
    public InfoRecepcion recepcion(@RequestParam Long motocicletaId) {
        return service.recepcion(motocicletaId);
    }

    @GetMapping("/{id}")
    @PreAuthorize(VER)
    public OrdenResponse obtener(@PathVariable Long id) {
        return web.detalle(service.detalle(id));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('ORDENES_CREAR')")
    public ResponseEntity<OrdenResponse> crear(@Valid @RequestBody CrearOrden datos) {
        OrdenTrabajo creada = service.crear(datos);
        URI ubicacion = ServletUriComponentsBuilder.fromCurrentRequest().path("/{id}")
                .buildAndExpand(creada.getId()).toUri();
        return ResponseEntity.created(ubicacion).body(web.detalle(service.detalle(creada.getId())));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('ORDENES_CREAR')")
    public OrdenResponse actualizar(@PathVariable Long id, @Valid @RequestBody ActualizarRecepcion datos) {
        service.actualizarRecepcion(id, datos);
        return obtener(id);
    }

    @PutMapping("/{id}/mecanicos")
    @PreAuthorize("hasAuthority('ORDENES_ASIGNAR')")
    public OrdenResponse asignarMecanicos(@PathVariable Long id, @Valid @RequestBody AsignarMecanicos datos) {
        service.asignarMecanicos(id, datos);
        return obtener(id);
    }

    @PutMapping("/{id}/diagnostico")
    @PreAuthorize("hasAuthority('ORDENES_TRABAJAR')")
    public OrdenResponse registrarDiagnostico(@PathVariable Long id, @Valid @RequestBody RegistrarDiagnostico datos) {
        service.registrarDiagnostico(id, datos);
        return obtener(id);
    }

    @PostMapping("/{id}/transiciones")
    @PreAuthorize(VER)
    public OrdenResponse transicionar(@PathVariable Long id, @Valid @RequestBody SolicitarTransicion datos) {
        service.transicionar(id, datos);
        return obtener(id);
    }

    private PageResponse<OrdenResumenResponse> pagina(Page<OrdenTrabajo> ordenes) {
        return new PageResponse<>(web.resumenes(ordenes.getContent()), ordenes.getNumber(), ordenes.getSize(),
                ordenes.getTotalElements(), ordenes.getTotalPages());
    }
}

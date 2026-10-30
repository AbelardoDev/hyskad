package com.hyskad.servicios.web;

import java.net.URI;

import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import com.hyskad.servicios.application.GuardarServicio;
import com.hyskad.servicios.application.ServicioService;
import com.hyskad.servicios.web.dto.ServicioResponse;
import com.hyskad.shared.web.CambioEstado;
import com.hyskad.shared.web.PageResponse;

import jakarta.validation.Valid;

/**
 * Catálogo de servicios (RF16): se gestiona con {@code SERVICIOS_GESTIONAR}. Lo consultan también
 * quienes trabajan órdenes ({@code ORDENES_TRABAJAR}) para agregar servicios a una orden (F09B).
 */
@RestController
@RequestMapping("/api/v1/servicios")
public class ServicioController {

    private final ServicioService service;
    private final ServicioMapper mapper;

    public ServicioController(ServicioService service, ServicioMapper mapper) {
        this.service = service;
        this.mapper = mapper;
    }

    @GetMapping
    @PreAuthorize("hasAnyAuthority('SERVICIOS_GESTIONAR', 'ORDENES_TRABAJAR')")
    public PageResponse<ServicioResponse> listar(@RequestParam(required = false) String q,
            @RequestParam(required = false) Boolean activo,
            @PageableDefault(sort = "nombre", direction = Sort.Direction.ASC) Pageable pagina) {
        return PageResponse.of(service.listar(q, activo, pagina), mapper::toResponse);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyAuthority('SERVICIOS_GESTIONAR', 'ORDENES_TRABAJAR')")
    public ServicioResponse obtener(@PathVariable Long id) {
        return mapper.toResponse(service.obtener(id));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('SERVICIOS_GESTIONAR')")
    public ResponseEntity<ServicioResponse> crear(@Valid @RequestBody GuardarServicio datos) {
        ServicioResponse creado = mapper.toResponse(service.crear(datos));
        URI ubicacion = ServletUriComponentsBuilder.fromCurrentRequest().path("/{id}")
                .buildAndExpand(creado.id()).toUri();
        return ResponseEntity.created(ubicacion).body(creado);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('SERVICIOS_GESTIONAR')")
    public ServicioResponse actualizar(@PathVariable Long id, @Valid @RequestBody GuardarServicio datos) {
        return mapper.toResponse(service.actualizar(id, datos));
    }

    @PatchMapping("/{id}/estado")
    @PreAuthorize("hasAuthority('SERVICIOS_GESTIONAR')")
    public ServicioResponse cambiarEstado(@PathVariable Long id, @Valid @RequestBody CambioEstado datos) {
        return mapper.toResponse(service.cambiarEstado(id, datos.activo()));
    }
}

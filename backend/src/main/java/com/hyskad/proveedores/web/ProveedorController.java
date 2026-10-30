package com.hyskad.proveedores.web;

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

import com.hyskad.proveedores.application.GuardarProveedor;
import com.hyskad.proveedores.application.ProveedorService;
import com.hyskad.proveedores.web.dto.ProveedorResponse;
import com.hyskad.shared.web.CambioEstado;
import com.hyskad.shared.web.PageResponse;

import jakarta.validation.Valid;

/** Proveedores (RF20): todo con {@code PROVEEDORES_GESTIONAR}. */
@RestController
@RequestMapping("/api/v1/proveedores")
@PreAuthorize("hasAuthority('PROVEEDORES_GESTIONAR')")
public class ProveedorController {

    private final ProveedorService service;
    private final ProveedorMapper mapper;

    public ProveedorController(ProveedorService service, ProveedorMapper mapper) {
        this.service = service;
        this.mapper = mapper;
    }

    @GetMapping
    public PageResponse<ProveedorResponse> listar(@RequestParam(required = false) String q,
            @RequestParam(required = false) Boolean activo,
            @PageableDefault(sort = "razonSocial", direction = Sort.Direction.ASC) Pageable pagina) {
        return PageResponse.of(service.listar(q, activo, pagina), mapper::toResponse);
    }

    @GetMapping("/{id}")
    public ProveedorResponse obtener(@PathVariable Long id) {
        return mapper.toResponse(service.obtener(id));
    }

    @PostMapping
    public ResponseEntity<ProveedorResponse> crear(@Valid @RequestBody GuardarProveedor datos) {
        ProveedorResponse creado = mapper.toResponse(service.crear(datos));
        URI ubicacion = ServletUriComponentsBuilder.fromCurrentRequest().path("/{id}")
                .buildAndExpand(creado.id()).toUri();
        return ResponseEntity.created(ubicacion).body(creado);
    }

    @PutMapping("/{id}")
    public ProveedorResponse actualizar(@PathVariable Long id, @Valid @RequestBody GuardarProveedor datos) {
        return mapper.toResponse(service.actualizar(id, datos));
    }

    @PatchMapping("/{id}/estado")
    public ProveedorResponse cambiarEstado(@PathVariable Long id, @Valid @RequestBody CambioEstado datos) {
        return mapper.toResponse(service.cambiarEstado(id, datos.activo()));
    }
}

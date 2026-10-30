package com.hyskad.catalogo.web;

import java.net.URI;
import java.util.List;

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

import com.hyskad.catalogo.application.CategoriaService;
import com.hyskad.catalogo.application.GuardarCategoria;
import com.hyskad.catalogo.web.dto.CategoriaResponse;
import com.hyskad.shared.web.CambioEstado;

import jakarta.validation.Valid;

/** Categorías (RF17): consultar con {@code PRODUCTOS_VER}, modificar con {@code PRODUCTOS_GESTIONAR}. */
@RestController
@RequestMapping("/api/v1/categorias")
public class CategoriaController {

    private final CategoriaService service;
    private final CatalogoMapper mapper;

    public CategoriaController(CategoriaService service, CatalogoMapper mapper) {
        this.service = service;
        this.mapper = mapper;
    }

    /** Pocas filas: lista completa sin paginar, ordenada por nombre. */
    @GetMapping
    @PreAuthorize("hasAuthority('PRODUCTOS_VER')")
    public List<CategoriaResponse> listar(@RequestParam(required = false) Boolean activo) {
        return service.listar(activo).stream().map(mapper::toResponse).toList();
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('PRODUCTOS_VER')")
    public CategoriaResponse obtener(@PathVariable Long id) {
        return mapper.toResponse(service.obtener(id));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('PRODUCTOS_GESTIONAR')")
    public ResponseEntity<CategoriaResponse> crear(@Valid @RequestBody GuardarCategoria datos) {
        CategoriaResponse creada = mapper.toResponse(service.crear(datos));
        URI ubicacion = ServletUriComponentsBuilder.fromCurrentRequest().path("/{id}")
                .buildAndExpand(creada.id()).toUri();
        return ResponseEntity.created(ubicacion).body(creada);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('PRODUCTOS_GESTIONAR')")
    public CategoriaResponse actualizar(@PathVariable Long id, @Valid @RequestBody GuardarCategoria datos) {
        return mapper.toResponse(service.actualizar(id, datos));
    }

    @PatchMapping("/{id}/estado")
    @PreAuthorize("hasAuthority('PRODUCTOS_GESTIONAR')")
    public CategoriaResponse cambiarEstado(@PathVariable Long id, @Valid @RequestBody CambioEstado datos) {
        return mapper.toResponse(service.cambiarEstado(id, datos.activo()));
    }
}

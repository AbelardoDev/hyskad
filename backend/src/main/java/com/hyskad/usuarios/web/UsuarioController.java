package com.hyskad.usuarios.web;

import java.net.URI;
import java.util.List;

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

import com.hyskad.shared.web.CambioEstado;
import com.hyskad.shared.web.PageResponse;
import com.hyskad.usuarios.application.ActualizarPermisos;
import com.hyskad.usuarios.application.ActualizarUsuario;
import com.hyskad.usuarios.application.CrearUsuario;
import com.hyskad.usuarios.application.PermisoDeUsuario;
import com.hyskad.usuarios.application.UsuarioService;
import com.hyskad.usuarios.domain.Rol;
import com.hyskad.usuarios.web.dto.UsuarioResponse;
import com.hyskad.usuarios.web.dto.UsuarioResumenResponse;

import jakarta.validation.Valid;

/** Administración de usuarios, roles y permisos (RF1–RF4). Solo con {@code USUARIOS_GESTIONAR}. */
@RestController
@RequestMapping("/api/v1/usuarios")
@PreAuthorize("hasAuthority('USUARIOS_GESTIONAR')")
public class UsuarioController {

    private final UsuarioService service;
    private final UsuarioMapper mapper;

    public UsuarioController(UsuarioService service, UsuarioMapper mapper) {
        this.service = service;
        this.mapper = mapper;
    }

    @GetMapping
    public PageResponse<UsuarioResponse> listar(@RequestParam(required = false) String q,
            @RequestParam(required = false) Rol rol, @RequestParam(required = false) Boolean activo,
            @PageableDefault(sort = "nombre", direction = Sort.Direction.ASC) Pageable pagina) {
        return PageResponse.of(service.listar(q, rol, activo, pagina), mapper::toResponse);
    }

    /**
     * Mecánicos activos (solo id y nombre) para asignar órdenes y filtrar el tablero: lo usan
     * quienes no administran usuarios, como el vendedor.
     */
    @GetMapping("/mecanicos")
    @PreAuthorize("hasAnyAuthority('ORDENES_ASIGNAR', 'ORDENES_VER_TODAS')")
    public List<UsuarioResumenResponse> mecanicos() {
        return service.mecanicosActivos().stream().map(u -> new UsuarioResumenResponse(u.getId(), u.getNombre()))
                .toList();
    }

    @GetMapping("/{id}")
    public UsuarioResponse obtener(@PathVariable Long id) {
        return mapper.toResponse(service.obtener(id));
    }

    @PostMapping
    public ResponseEntity<UsuarioResponse> crear(@Valid @RequestBody CrearUsuario datos) {
        UsuarioResponse creado = mapper.toResponse(service.crear(datos));
        URI ubicacion = ServletUriComponentsBuilder.fromCurrentRequest().path("/{id}")
                .buildAndExpand(creado.id()).toUri();
        return ResponseEntity.created(ubicacion).body(creado);
    }

    @PutMapping("/{id}")
    public UsuarioResponse actualizar(@PathVariable Long id, @Valid @RequestBody ActualizarUsuario datos) {
        return mapper.toResponse(service.actualizar(id, datos));
    }

    @PatchMapping("/{id}/estado")
    public UsuarioResponse cambiarEstado(@PathVariable Long id, @Valid @RequestBody CambioEstado datos) {
        return mapper.toResponse(service.cambiarEstado(id, datos.activo()));
    }

    @GetMapping("/{id}/permisos")
    public List<PermisoDeUsuario> permisos(@PathVariable Long id) {
        return service.permisos(id);
    }

    @PutMapping("/{id}/permisos")
    public List<PermisoDeUsuario> actualizarPermisos(@PathVariable Long id,
            @Valid @RequestBody ActualizarPermisos datos) {
        return service.actualizarPermisos(id, datos);
    }
}

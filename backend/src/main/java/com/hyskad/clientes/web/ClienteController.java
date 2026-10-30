package com.hyskad.clientes.web;

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

import com.hyskad.clientes.application.ClienteService;
import com.hyskad.clientes.application.GuardarCliente;
import com.hyskad.clientes.web.dto.ClienteResponse;
import com.hyskad.clientes.web.dto.ClienteResumenResponse;
import com.hyskad.shared.web.CambioEstado;
import com.hyskad.shared.web.PageResponse;

import jakarta.validation.Valid;

/** Clientes (RF5, RF6, RF29): consultar con {@code CLIENTES_VER}, modificar con {@code CLIENTES_GESTIONAR}. */
@RestController
@RequestMapping("/api/v1/clientes")
public class ClienteController {

    private final ClienteService service;
    private final ClienteMapper mapper;

    public ClienteController(ClienteService service, ClienteMapper mapper) {
        this.service = service;
        this.mapper = mapper;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('CLIENTES_VER')")
    public PageResponse<ClienteResumenResponse> listar(@RequestParam(required = false) String q,
            @RequestParam(required = false) Boolean activo,
            @PageableDefault(sort = "nombreCompleto", direction = Sort.Direction.ASC) Pageable pagina) {
        return PageResponse.of(service.listar(q, activo, pagina), mapper::toResumen);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('CLIENTES_VER')")
    public ClienteResponse obtener(@PathVariable Long id) {
        return mapper.toResponse(service.obtener(id));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('CLIENTES_GESTIONAR')")
    public ResponseEntity<ClienteResponse> crear(@Valid @RequestBody GuardarCliente datos) {
        ClienteResponse creado = mapper.toResponse(service.crear(datos));
        URI ubicacion = ServletUriComponentsBuilder.fromCurrentRequest().path("/{id}")
                .buildAndExpand(creado.id()).toUri();
        return ResponseEntity.created(ubicacion).body(creado);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('CLIENTES_GESTIONAR')")
    public ClienteResponse actualizar(@PathVariable Long id, @Valid @RequestBody GuardarCliente datos) {
        return mapper.toResponse(service.actualizar(id, datos));
    }

    @PatchMapping("/{id}/estado")
    @PreAuthorize("hasAuthority('CLIENTES_GESTIONAR')")
    public ClienteResponse cambiarEstado(@PathVariable Long id, @Valid @RequestBody CambioEstado datos) {
        return mapper.toResponse(service.cambiarEstado(id, datos.activo()));
    }
}

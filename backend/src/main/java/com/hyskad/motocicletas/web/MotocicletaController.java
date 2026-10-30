package com.hyskad.motocicletas.web;

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

import com.hyskad.motocicletas.application.ActualizarMotocicleta;
import com.hyskad.motocicletas.application.CambiarPropietario;
import com.hyskad.motocicletas.application.CrearMotocicleta;
import com.hyskad.motocicletas.application.HistorialServicio;
import com.hyskad.motocicletas.application.MotocicletaService;
import com.hyskad.motocicletas.web.dto.MotocicletaResponse;
import com.hyskad.shared.web.CambioEstado;
import com.hyskad.shared.web.PageResponse;

import jakarta.validation.Valid;

/**
 * Motocicletas (RF7–RF9, RF29): consultar con {@code MOTOS_VER}, modificar con
 * {@code MOTOS_GESTIONAR}. También sirve las motos de un cliente ({@code /clientes/{id}/motocicletas}).
 */
@RestController
@RequestMapping("/api/v1")
public class MotocicletaController {

    private final MotocicletaService service;
    private final MotocicletaMapper mapper;

    public MotocicletaController(MotocicletaService service, MotocicletaMapper mapper) {
        this.service = service;
        this.mapper = mapper;
    }

    @GetMapping("/motocicletas")
    @PreAuthorize("hasAuthority('MOTOS_VER')")
    public PageResponse<MotocicletaResponse> listar(@RequestParam(required = false) String placa,
            @RequestParam(required = false) String marca, @RequestParam(required = false) String modelo,
            @RequestParam(required = false) Long clienteId, @RequestParam(required = false) Boolean activo,
            @PageableDefault(sort = "placa", direction = Sort.Direction.ASC) Pageable pagina) {
        return PageResponse.of(service.listar(placa, marca, modelo, clienteId, activo, pagina), mapper::toResponse);
    }

    @GetMapping("/clientes/{clienteId}/motocicletas")
    @PreAuthorize("hasAuthority('MOTOS_VER')")
    public List<MotocicletaResponse> delCliente(@PathVariable Long clienteId) {
        return service.delCliente(clienteId).stream().map(mapper::toResponse).toList();
    }

    @GetMapping("/motocicletas/{id}")
    @PreAuthorize("hasAuthority('MOTOS_VER')")
    public MotocicletaResponse obtener(@PathVariable Long id) {
        return mapper.toResponse(service.obtener(id));
    }

    @GetMapping("/motocicletas/{id}/historial")
    @PreAuthorize("hasAuthority('MOTOS_VER')")
    public List<HistorialServicio> historial(@PathVariable Long id) {
        return service.historial(id);
    }

    @PostMapping("/motocicletas")
    @PreAuthorize("hasAuthority('MOTOS_GESTIONAR')")
    public ResponseEntity<MotocicletaResponse> crear(@Valid @RequestBody CrearMotocicleta datos) {
        MotocicletaResponse creada = mapper.toResponse(service.crear(datos));
        URI ubicacion = ServletUriComponentsBuilder.fromCurrentRequest().path("/{id}")
                .buildAndExpand(creada.id()).toUri();
        return ResponseEntity.created(ubicacion).body(creada);
    }

    @PutMapping("/motocicletas/{id}")
    @PreAuthorize("hasAuthority('MOTOS_GESTIONAR')")
    public MotocicletaResponse actualizar(@PathVariable Long id, @Valid @RequestBody ActualizarMotocicleta datos) {
        return mapper.toResponse(service.actualizar(id, datos));
    }

    @PatchMapping("/motocicletas/{id}/estado")
    @PreAuthorize("hasAuthority('MOTOS_GESTIONAR')")
    public MotocicletaResponse cambiarEstado(@PathVariable Long id, @Valid @RequestBody CambioEstado datos) {
        return mapper.toResponse(service.cambiarEstado(id, datos.activo()));
    }

    @PatchMapping("/motocicletas/{id}/propietario")
    @PreAuthorize("hasAuthority('MOTOS_GESTIONAR')")
    public MotocicletaResponse cambiarPropietario(@PathVariable Long id,
            @Valid @RequestBody CambiarPropietario datos) {
        return mapper.toResponse(service.cambiarPropietario(id, datos.clienteId()));
    }
}

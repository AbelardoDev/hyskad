package com.hyskad.compras.web;

import java.net.URI;
import java.time.LocalDate;

import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.data.web.SortDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import com.hyskad.compras.application.AnularCompra;
import com.hyskad.compras.application.CompraService;
import com.hyskad.compras.application.FiltroCompras;
import com.hyskad.compras.application.RegistrarCompra;
import com.hyskad.compras.domain.EstadoCompra;
import com.hyskad.compras.web.dto.CompraResponse;
import com.hyskad.compras.web.dto.CompraResumenResponse;
import com.hyskad.shared.web.PageResponse;

import jakarta.validation.Valid;

/** Compras a proveedores (RF21): todo con {@code COMPRAS_GESTIONAR} (admin y almacén, RN-17). */
@RestController
@RequestMapping("/api/v1/compras")
@PreAuthorize("hasAuthority('COMPRAS_GESTIONAR')")
public class CompraController {

    private final CompraService service;
    private final ComprasWeb web;

    public CompraController(CompraService service, ComprasWeb web) {
        this.service = service;
        this.web = web;
    }

    /** {@code desde} y {@code hasta} (fecha de la factura) son inclusivos. */
    @GetMapping
    public PageResponse<CompraResumenResponse> listar(@RequestParam(required = false) Long proveedorId,
            @RequestParam(required = false) LocalDate desde, @RequestParam(required = false) LocalDate hasta,
            @RequestParam(required = false) EstadoCompra estado, @RequestParam(required = false) String numero,
            @PageableDefault(size = 20) @SortDefault(sort = { "fecha", "id" }, direction = Sort.Direction.DESC)
            Pageable pagina) {
        return PageResponse.of(service.listar(new FiltroCompras(proveedorId, desde, hasta, estado, numero), pagina),
                web::resumen);
    }

    @GetMapping("/{id}")
    public CompraResponse obtener(@PathVariable Long id) {
        return web.detalle(service.obtener(id));
    }

    @PostMapping
    public ResponseEntity<CompraResponse> registrar(@Valid @RequestBody RegistrarCompra datos) {
        CompraResponse registrada = web.detalle(service.registrar(datos));
        URI ubicacion = ServletUriComponentsBuilder.fromCurrentRequest().path("/{id}")
                .buildAndExpand(registrada.id()).toUri();
        return ResponseEntity.created(ubicacion).body(registrada);
    }

    @PostMapping("/{id}/anulacion")
    public CompraResponse anular(@PathVariable Long id, @Valid @RequestBody AnularCompra datos) {
        return web.detalle(service.anular(id, datos));
    }
}

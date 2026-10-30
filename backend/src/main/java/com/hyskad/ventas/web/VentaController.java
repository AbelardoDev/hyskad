package com.hyskad.ventas.web;

import java.net.URI;
import java.time.LocalDate;

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
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import com.hyskad.shared.web.PageResponse;
import com.hyskad.ventas.application.AnularVenta;
import com.hyskad.ventas.application.FiltroVentas;
import com.hyskad.ventas.application.RegistrarVenta;
import com.hyskad.ventas.application.VentaService;
import com.hyskad.ventas.application.VentaService.Comprobante;
import com.hyskad.ventas.application.VentaService.ResumenVentas;
import com.hyskad.ventas.domain.EstadoVenta;
import com.hyskad.ventas.domain.MetodoPago;
import com.hyskad.ventas.domain.Venta;
import com.hyskad.ventas.web.dto.ComprobanteResponse;
import com.hyskad.ventas.web.dto.VentaResponse;
import com.hyskad.ventas.web.dto.VentaResumenResponse;

import jakarta.validation.Valid;

/**
 * Ventas de mostrador: consultar con {@code VENTAS_VER}, vender con {@code VENTAS_CREAR} y anular
 * con {@code VENTAS_ANULAR} (RN-21).
 */
@RestController
@RequestMapping("/api/v1/ventas")
public class VentaController {

    private final VentaService service;
    private final VentasWeb web;

    public VentaController(VentaService service, VentasWeb web) {
        this.service = service;
        this.web = web;
    }

    /** {@code desde} y {@code hasta} son días de Colombia, inclusivos. */
    @GetMapping
    @PreAuthorize("hasAuthority('VENTAS_VER')")
    public PageResponse<VentaResumenResponse> listar(@RequestParam(required = false) LocalDate desde,
            @RequestParam(required = false) LocalDate hasta, @RequestParam(required = false) Long clienteId,
            @RequestParam(required = false) Long vendedorId, @RequestParam(required = false) MetodoPago metodo,
            @RequestParam(required = false) EstadoVenta estado, @RequestParam(required = false) String numero,
            @PageableDefault(size = 20) @SortDefault(sort = { "fecha", "id" }, direction = Sort.Direction.DESC)
            Pageable pagina) {
        Page<Venta> ventas = service.listar(new FiltroVentas(desde, hasta, clienteId, vendedorId, metodo, estado,
                numero), pagina);
        return new PageResponse<>(web.resumenes(ventas.getContent()), ventas.getNumber(), ventas.getSize(),
                ventas.getTotalElements(), ventas.getTotalPages());
    }

    /** Cantidad y total con los mismos filtros del listado (incluye el estado, si se filtra). */
    @GetMapping("/resumen")
    @PreAuthorize("hasAuthority('VENTAS_VER')")
    public ResumenVentas resumen(@RequestParam(required = false) LocalDate desde,
            @RequestParam(required = false) LocalDate hasta, @RequestParam(required = false) Long clienteId,
            @RequestParam(required = false) Long vendedorId, @RequestParam(required = false) MetodoPago metodo,
            @RequestParam(required = false) EstadoVenta estado, @RequestParam(required = false) String numero) {
        return service.resumir(new FiltroVentas(desde, hasta, clienteId, vendedorId, metodo, estado, numero));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('VENTAS_VER')")
    public VentaResponse obtener(@PathVariable Long id) {
        return web.detalle(service.obtener(id));
    }

    @GetMapping("/{id}/comprobante")
    @PreAuthorize("hasAuthority('VENTAS_VER')")
    public ComprobanteResponse comprobante(@PathVariable Long id) {
        Comprobante comprobante = service.comprobante(id);
        return web.comprobante(comprobante.venta(), comprobante.taller());
    }

    @PostMapping
    @PreAuthorize("hasAuthority('VENTAS_CREAR')")
    public ResponseEntity<VentaResponse> registrar(@Valid @RequestBody RegistrarVenta datos) {
        VentaResponse registrada = web.detalle(service.registrar(datos));
        URI ubicacion = ServletUriComponentsBuilder.fromCurrentRequest().path("/{id}")
                .buildAndExpand(registrada.id()).toUri();
        return ResponseEntity.created(ubicacion).body(registrada);
    }

    @PostMapping("/{id}/anulacion")
    @PreAuthorize("hasAuthority('VENTAS_ANULAR')")
    public VentaResponse anular(@PathVariable Long id, @Valid @RequestBody AnularVenta datos) {
        return web.detalle(service.anular(id, datos));
    }
}

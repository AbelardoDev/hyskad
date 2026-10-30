package com.hyskad.catalogo.web;

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

import com.hyskad.catalogo.application.GuardarProducto;
import com.hyskad.catalogo.application.ProductoService;
import com.hyskad.catalogo.domain.Producto;
import com.hyskad.catalogo.web.dto.ProductoResponse;
import com.hyskad.shared.security.UsuarioActual;
import com.hyskad.shared.web.CambioEstado;
import com.hyskad.shared.web.PageResponse;

import jakarta.validation.Valid;

/**
 * Productos (RF17, RF18, RF29): consultar con {@code PRODUCTOS_VER}, modificar con
 * {@code PRODUCTOS_GESTIONAR}. El costo promedio solo se muestra a quien puede gestionarlos.
 */
@RestController
@RequestMapping("/api/v1/productos")
public class ProductoController {

    static final String VE_COSTOS = "PRODUCTOS_GESTIONAR";

    private final ProductoService service;
    private final CatalogoMapper mapper;
    private final UsuarioActual usuarioActual;

    public ProductoController(ProductoService service, CatalogoMapper mapper, UsuarioActual usuarioActual) {
        this.service = service;
        this.mapper = mapper;
        this.usuarioActual = usuarioActual;
    }

    @GetMapping
    @PreAuthorize("hasAuthority('PRODUCTOS_VER')")
    public PageResponse<ProductoResponse> listar(@RequestParam(required = false) String q,
            @RequestParam(required = false) Long categoriaId, @RequestParam(required = false) String marca,
            @RequestParam(required = false) Boolean activo,
            @RequestParam(defaultValue = "false") boolean soloStockBajo,
            @PageableDefault(sort = "nombre", direction = Sort.Direction.ASC) Pageable pagina) {
        return PageResponse.of(service.listar(q, categoriaId, marca, activo, soloStockBajo, pagina), this::respuesta);
    }

    @GetMapping("/stock-bajo")
    @PreAuthorize("hasAuthority('PRODUCTOS_VER')")
    public List<ProductoResponse> stockBajo() {
        return service.conStockBajo().stream().map(this::respuesta).toList();
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('PRODUCTOS_VER')")
    public ProductoResponse obtener(@PathVariable Long id) {
        return respuesta(service.obtener(id));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('PRODUCTOS_GESTIONAR')")
    public ResponseEntity<ProductoResponse> crear(@Valid @RequestBody GuardarProducto datos) {
        ProductoResponse creado = respuesta(service.crear(datos));
        URI ubicacion = ServletUriComponentsBuilder.fromCurrentRequest().path("/{id}")
                .buildAndExpand(creado.id()).toUri();
        return ResponseEntity.created(ubicacion).body(creado);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('PRODUCTOS_GESTIONAR')")
    public ProductoResponse actualizar(@PathVariable Long id, @Valid @RequestBody GuardarProducto datos) {
        return respuesta(service.actualizar(id, datos));
    }

    @PatchMapping("/{id}/estado")
    @PreAuthorize("hasAuthority('PRODUCTOS_GESTIONAR')")
    public ProductoResponse cambiarEstado(@PathVariable Long id, @Valid @RequestBody CambioEstado datos) {
        return respuesta(service.cambiarEstado(id, datos.activo()));
    }

    private ProductoResponse respuesta(Producto producto) {
        ProductoResponse completa = mapper.toResponse(producto);
        return usuarioActual.permisos().contains(VE_COSTOS) ? completa : completa.sinCosto();
    }
}

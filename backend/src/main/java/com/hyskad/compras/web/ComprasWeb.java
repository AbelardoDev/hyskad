package com.hyskad.compras.web;

import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import org.springframework.stereotype.Component;

import com.hyskad.catalogo.domain.Producto;
import com.hyskad.compras.domain.Compra;
import com.hyskad.compras.domain.CompraDetalle;
import com.hyskad.compras.web.dto.CompraResponse;
import com.hyskad.compras.web.dto.CompraResumenResponse;
import com.hyskad.proveedores.domain.Proveedor;
import com.hyskad.usuarios.application.UsuarioService;

/** Arma las respuestas de compras con los nombres de quien las registró y anuló. */
@Component
class ComprasWeb {

    private final UsuarioService usuarios;

    ComprasWeb(UsuarioService usuarios) {
        this.usuarios = usuarios;
    }

    CompraResumenResponse resumen(Compra c) {
        return new CompraResumenResponse(c.getId(), c.getNumero(), proveedor(c.getProveedor()),
                c.getNumeroFacturaProveedor(), c.getFecha(), c.getTotal(), c.getEstado());
    }

    CompraResponse detalle(Compra c) {
        Map<Long, String> nombres = usuarios.nombres(Stream.of(c.getCreatedBy(), c.getAnuladaPor())
                .filter(Objects::nonNull).collect(Collectors.toSet()));
        return new CompraResponse(c.getId(), c.getNumero(), proveedor(c.getProveedor()),
                c.getNumeroFacturaProveedor(), c.getFecha(), c.getSubtotal(), c.getIvaPorcentaje(), c.getImpuesto(),
                c.getTotal(), c.getEstado(), c.getDetalles().stream().map(ComprasWeb::item).toList(),
                usuario(c.getCreatedBy(), nombres), c.getCreatedAt(), c.getMotivoAnulacion(),
                usuario(c.getAnuladaPor(), nombres), c.getAnuladaEn());
    }

    private static CompraResponse.Item item(CompraDetalle d) {
        Producto p = d.getProducto();
        return new CompraResponse.Item(d.getId(),
                new CompraResponse.ProductoResumen(p.getId(), p.getCodigo(), p.getNombre(), p.getUnidad(),
                        p.getStockActual(), p.getStockDisponible(), p.getCostoPromedio()),
                d.getCantidad(), d.getCostoUnitario(), d.getSubtotal());
    }

    private static CompraResponse.ProveedorResumen proveedor(Proveedor p) {
        return new CompraResponse.ProveedorResumen(p.getId(), p.getRazonSocial(), p.getNumeroDocumento());
    }

    private static CompraResponse.UsuarioResumen usuario(Long id, Map<Long, String> nombres) {
        return id == null ? null : new CompraResponse.UsuarioResumen(id, nombres.get(id));
    }
}

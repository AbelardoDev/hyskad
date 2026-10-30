package com.hyskad.ventas.web;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import org.springframework.stereotype.Component;

import com.hyskad.catalogo.domain.Producto;
import com.hyskad.clientes.domain.Cliente;
import com.hyskad.configuracion.application.DatosTaller;
import com.hyskad.usuarios.application.UsuarioService;
import com.hyskad.ventas.domain.Venta;
import com.hyskad.ventas.domain.VentaDetalle;
import com.hyskad.ventas.web.dto.ComprobanteResponse;
import com.hyskad.ventas.web.dto.VentaResponse;
import com.hyskad.ventas.web.dto.VentaResumenResponse;

/** Arma las respuestas de ventas con los nombres del vendedor y de quien anuló. */
@Component
class VentasWeb {

    private final UsuarioService usuarios;

    VentasWeb(UsuarioService usuarios) {
        this.usuarios = usuarios;
    }

    List<VentaResumenResponse> resumenes(Collection<Venta> ventas) {
        Map<Long, String> nombres = usuarios.nombres(ventas.stream().map(Venta::getCreatedBy)
                .filter(Objects::nonNull).collect(Collectors.toSet()));
        return ventas.stream().map(v -> new VentaResumenResponse(v.getId(), v.getNumero(), v.getFecha(),
                v.getCliente() == null ? null : v.getCliente().getNombreCompleto(),
                usuario(v.getCreatedBy(), nombres), v.getMetodoPago(), v.getTotal(), v.getEstado())).toList();
    }

    VentaResponse detalle(Venta v) {
        Map<Long, String> nombres = usuarios.nombres(Stream.of(v.getCreatedBy(), v.getAnuladaPor())
                .filter(Objects::nonNull).collect(Collectors.toSet()));
        return new VentaResponse(v.getId(), v.getNumero(), v.getFecha(), cliente(v.getCliente()),
                v.getDetalles().stream().map(VentasWeb::item).toList(), v.getSubtotal(), v.getDescuento(),
                v.getIvaPorcentaje(), v.getImpuesto(), v.getTotal(), v.getMetodoPago(), v.getReferenciaPago(),
                v.getMontoRecibido(), v.getCambio(), v.getEstado(), usuario(v.getCreatedBy(), nombres),
                v.getMotivoAnulacion(), usuario(v.getAnuladaPor(), nombres), v.getAnuladaEn());
    }

    ComprobanteResponse comprobante(Venta venta, DatosTaller taller) {
        return new ComprobanteResponse(new ComprobanteResponse.Taller(taller.nombre(), taller.nit(),
                taller.direccion(), taller.telefono()), detalle(venta), ComprobanteResponse.LEYENDA);
    }

    private static VentaResponse.Item item(VentaDetalle d) {
        Producto p = d.getProducto();
        return new VentaResponse.Item(d.getId(), p.getId(), p.getCodigo(), p.getNombre(), p.getUnidad(),
                d.getCantidad(), d.getPrecioUnitario(), d.getSubtotal());
    }

    private static VentaResponse.ClienteResumen cliente(Cliente c) {
        return c == null ? null : new VentaResponse.ClienteResumen(c.getId(), c.getNombreCompleto(),
                c.getTipoDocumento(), c.getNumeroDocumento(), c.getTelefono());
    }

    private static VentaResponse.UsuarioResumen usuario(Long id, Map<Long, String> nombres) {
        return id == null ? null : new VentaResponse.UsuarioResumen(id, nombres.get(id));
    }
}

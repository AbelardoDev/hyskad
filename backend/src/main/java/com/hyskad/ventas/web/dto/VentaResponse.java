package com.hyskad.ventas.web.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

import com.hyskad.catalogo.domain.Unidad;
import com.hyskad.shared.validation.TipoDocumento;
import com.hyskad.ventas.domain.EstadoVenta;
import com.hyskad.ventas.domain.MetodoPago;

/**
 * Venta con sus ítems a los precios congelados. Sin costos (son para reportes de utilidad). Sin
 * cliente es consumidor final.
 */
public record VentaResponse(Long id, String numero, Instant fecha, ClienteResumen cliente, List<Item> items,
        BigDecimal subtotal, BigDecimal descuento, BigDecimal ivaPorcentaje, BigDecimal impuesto, BigDecimal total,
        MetodoPago metodoPago, String referenciaPago, BigDecimal montoRecibido, BigDecimal cambio,
        EstadoVenta estado, UsuarioResumen vendedor, String motivoAnulacion, UsuarioResumen anuladaPor,
        Instant anuladaEn) {

    public record ClienteResumen(Long id, String nombreCompleto, TipoDocumento tipoDocumento,
            String numeroDocumento, String telefono) {
    }

    public record Item(Long id, Long productoId, String codigo, String nombre, Unidad unidad, BigDecimal cantidad,
            BigDecimal precioUnitario, BigDecimal subtotal) {
    }

    public record UsuarioResumen(Long id, String nombre) {
    }
}

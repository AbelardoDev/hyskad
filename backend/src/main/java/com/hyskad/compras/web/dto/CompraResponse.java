package com.hyskad.compras.web.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import com.hyskad.catalogo.domain.Unidad;
import com.hyskad.compras.domain.EstadoCompra;

/**
 * Compra con sus ítems. Cada ítem trae además el stock y el costo promedio actuales del producto,
 * para ver el efecto de la compra (y si se puede anular).
 */
public record CompraResponse(Long id, String numero, ProveedorResumen proveedor, String numeroFacturaProveedor,
        LocalDate fecha, BigDecimal subtotal, BigDecimal ivaPorcentaje, BigDecimal impuesto, BigDecimal total,
        EstadoCompra estado, List<Item> items, UsuarioResumen registradaPor, Instant createdAt,
        String motivoAnulacion, UsuarioResumen anuladaPor, Instant anuladaEn) {

    public record ProveedorResumen(Long id, String razonSocial, String numeroDocumento) {
    }

    public record Item(Long id, ProductoResumen producto, BigDecimal cantidad, BigDecimal costoUnitario,
            BigDecimal subtotal) {
    }

    public record ProductoResumen(Long id, String codigo, String nombre, Unidad unidad, BigDecimal stockActual,
            BigDecimal stockDisponible, BigDecimal costoPromedio) {
    }

    public record UsuarioResumen(Long id, String nombre) {
    }
}

package com.hyskad.ventas.domain;

import java.math.BigDecimal;

import com.hyskad.catalogo.domain.Producto;
import com.hyskad.shared.dinero.CalculadoraTotales;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * Ítem de una venta con el precio y el costo congelados al venderse (RN-08): un cambio de precio o
 * de costo después no altera la venta ni la utilidad calculada.
 */
@Entity
@Table(name = "venta_detalle")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class VentaDetalle {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "venta_id", nullable = false, updatable = false)
    private Venta venta;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "producto_id", nullable = false, updatable = false)
    private Producto producto;

    @Column(nullable = false, updatable = false, precision = 12, scale = 2)
    private BigDecimal cantidad;

    @Column(name = "precio_unitario", nullable = false, updatable = false, precision = 15, scale = 2)
    private BigDecimal precioUnitario;

    @Column(name = "costo_unitario", nullable = false, precision = 15, scale = 2)
    private BigDecimal costoUnitario;

    @Column(nullable = false, updatable = false, precision = 15, scale = 2)
    private BigDecimal subtotal;

    VentaDetalle(Venta venta, Producto producto, BigDecimal cantidad) {
        this.venta = venta;
        this.producto = producto;
        this.cantidad = cantidad;
        this.precioUnitario = producto.getPrecioVenta();
        this.costoUnitario = producto.getCostoPromedio();
        this.subtotal = CalculadoraTotales.subtotalLinea(cantidad, precioUnitario);
    }

    /** El costo que aplicó el inventario al sacar la mercancía, con la fila del producto bloqueada. */
    public void congelarCosto(BigDecimal costoAplicado) {
        this.costoUnitario = costoAplicado;
    }
}

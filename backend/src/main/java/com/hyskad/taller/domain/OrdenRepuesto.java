package com.hyskad.taller.domain;

import java.math.BigDecimal;
import java.time.Instant;

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
 * Repuesto de la orden (RF19, RN-29): su cantidad está reservada en el inventario mientras la
 * orden lo tenga. El precio se congela al agregarlo; el costo, al finalizar la orden.
 */
@Entity
@Table(name = "orden_repuesto")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class OrdenRepuesto {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "orden_id", nullable = false, updatable = false)
    private OrdenTrabajo orden;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "producto_id", nullable = false, updatable = false)
    private Producto producto;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal cantidad;

    @Column(name = "precio_unitario", nullable = false, updatable = false, precision = 15, scale = 2)
    private BigDecimal precioUnitario;

    @Column(name = "costo_unitario", precision = 15, scale = 2)
    private BigDecimal costoUnitario;

    @Column(name = "agregado_por", updatable = false)
    private Long agregadoPor;

    @Column(name = "agregado_en", nullable = false, updatable = false)
    private Instant agregadoEn;

    OrdenRepuesto(OrdenTrabajo orden, Producto producto, BigDecimal cantidad, Long agregadoPor, Instant agregadoEn) {
        this.orden = orden;
        this.producto = producto;
        this.cantidad = cantidad;
        this.precioUnitario = producto.getPrecioVenta();
        this.agregadoPor = agregadoPor;
        this.agregadoEn = agregadoEn;
    }

    public BigDecimal getSubtotal() {
        return CalculadoraTotales.subtotalLinea(cantidad, precioUnitario);
    }

    void cambiarCantidad(BigDecimal cantidad) {
        this.cantidad = cantidad;
    }

    /** RN-08: el costo aplicado al salir del inventario, para la utilidad de la orden. */
    public void congelarCosto(BigDecimal costoUnitario) {
        this.costoUnitario = costoUnitario;
    }
}

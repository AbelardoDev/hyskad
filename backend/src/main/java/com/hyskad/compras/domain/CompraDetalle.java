package com.hyskad.compras.domain;

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

/** Ítem de una compra: cantidad y costo unitario sin IVA, como entraron al inventario. */
@Entity
@Table(name = "compra_detalle")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class CompraDetalle {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "compra_id", nullable = false, updatable = false)
    private Compra compra;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "producto_id", nullable = false, updatable = false)
    private Producto producto;

    @Column(nullable = false, updatable = false, precision = 12, scale = 2)
    private BigDecimal cantidad;

    @Column(name = "costo_unitario", nullable = false, updatable = false, precision = 15, scale = 2)
    private BigDecimal costoUnitario;

    @Column(nullable = false, updatable = false, precision = 15, scale = 2)
    private BigDecimal subtotal;

    CompraDetalle(Compra compra, Producto producto, BigDecimal cantidad, BigDecimal costoUnitario) {
        this.compra = compra;
        this.producto = producto;
        this.cantidad = cantidad;
        this.costoUnitario = costoUnitario;
        this.subtotal = CalculadoraTotales.subtotalLinea(cantidad, costoUnitario);
    }
}

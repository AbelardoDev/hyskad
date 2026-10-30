package com.hyskad.inventario.domain;

import java.math.BigDecimal;
import java.time.Instant;

import org.hibernate.annotations.Immutable;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import com.hyskad.catalogo.domain.Producto;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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
 * Movimiento de inventario (RN-11): inmutable, solo se inserta. Guarda el costo aplicado y el stock
 * resultante para reconstruir el kárdex y calcular utilidades.
 */
@Entity
@Immutable
@Table(name = "movimiento_inventario")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class MovimientoInventario {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "producto_id", nullable = false, updatable = false)
    private Producto producto;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(nullable = false, updatable = false, length = 30)
    private TipoMovimiento tipo;

    @Column(nullable = false, updatable = false, precision = 12, scale = 2)
    private BigDecimal cantidad;

    @Column(name = "costo_unitario", nullable = false, updatable = false, precision = 15, scale = 2)
    private BigDecimal costoUnitario;

    @Column(name = "stock_resultante", nullable = false, updatable = false, precision = 12, scale = 2)
    private BigDecimal stockResultante;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "referencia_tipo", updatable = false, length = 20)
    private Referencia.TipoReferencia referenciaTipo;

    @Column(name = "referencia_id", updatable = false)
    private Long referenciaId;

    @Column(name = "referencia_numero", updatable = false, length = 30)
    private String referenciaNumero;

    @Column(updatable = false, length = 500)
    private String motivo;

    @Column(name = "usuario_id", updatable = false)
    private Long usuarioId;

    @Column(nullable = false, updatable = false)
    private Instant fecha;

    public MovimientoInventario(Producto producto, TipoMovimiento tipo, BigDecimal cantidad, BigDecimal costoUnitario,
            Referencia referencia, String motivo, Long usuarioId, Instant fecha) {
        this.producto = producto;
        this.tipo = tipo;
        this.cantidad = cantidad;
        this.costoUnitario = costoUnitario;
        this.stockResultante = producto.getStockActual();
        if (referencia != null) {
            this.referenciaTipo = referencia.tipo();
            this.referenciaId = referencia.id();
            this.referenciaNumero = referencia.numero();
        }
        this.motivo = motivo;
        this.usuarioId = usuarioId;
        this.fecha = fecha;
    }
}

package com.hyskad.taller.domain;

import java.math.BigDecimal;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import com.hyskad.shared.dinero.CalculadoraTotales;

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

/** Línea congelada de un presupuesto (RN-31): no cambia aunque cambien la orden o los precios. */
@Entity
@Table(name = "presupuesto_item")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PresupuestoItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "presupuesto_id", nullable = false, updatable = false)
    private Presupuesto presupuesto;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(nullable = false, updatable = false, length = 10)
    private Presupuesto.TipoItem tipo;

    @Column(nullable = false, updatable = false, length = 200)
    private String descripcion;

    @Column(nullable = false, updatable = false, precision = 12, scale = 2)
    private BigDecimal cantidad;

    @Column(name = "precio_unitario", nullable = false, updatable = false, precision = 15, scale = 2)
    private BigDecimal precioUnitario;

    @Column(nullable = false, updatable = false, precision = 15, scale = 2)
    private BigDecimal subtotal;

    PresupuestoItem(Presupuesto presupuesto, Presupuesto.TipoItem tipo, String descripcion, BigDecimal cantidad,
            BigDecimal precioUnitario) {
        this.presupuesto = presupuesto;
        this.tipo = tipo;
        this.descripcion = descripcion.length() > 200 ? descripcion.substring(0, 200) : descripcion;
        this.cantidad = cantidad;
        this.precioUnitario = precioUnitario;
        this.subtotal = CalculadoraTotales.subtotalLinea(cantidad, precioUnitario);
    }
}

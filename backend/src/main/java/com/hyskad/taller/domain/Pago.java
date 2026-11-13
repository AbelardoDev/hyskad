package com.hyskad.taller.domain;

import java.math.BigDecimal;
import java.time.Instant;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import com.hyskad.shared.dinero.MetodoPago;

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
 * RN-35: pago total y único de una orden finalizada. Inmutable; la referencia solo existe fuera
 * del efectivo y el monto recibido solo en efectivo (RN-20).
 */
@Entity
@Table(name = "pago")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Pago {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "orden_id", nullable = false, updatable = false)
    private OrdenTrabajo orden;

    @Column(nullable = false, updatable = false, precision = 15, scale = 2)
    private BigDecimal monto;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(nullable = false, updatable = false, length = 15)
    private MetodoPago metodo;

    @Column(updatable = false, length = 60)
    private String referencia;

    @Column(name = "monto_recibido", updatable = false, precision = 15, scale = 2)
    private BigDecimal montoRecibido;

    @Column(nullable = false, updatable = false)
    private Instant fecha;

    @Column(name = "usuario_id", updatable = false)
    private Long usuarioId;

    Pago(OrdenTrabajo orden, DatosPago datos, Long usuarioId, Instant fecha) {
        this.orden = orden;
        this.monto = datos.monto();
        this.metodo = datos.metodo();
        this.referencia = datos.metodo().requiereReferencia() ? datos.referencia() : null;
        this.montoRecibido = datos.metodo() == MetodoPago.EFECTIVO ? datos.montoRecibido() : null;
        this.usuarioId = usuarioId;
        this.fecha = fecha;
    }

    /** Cambio a devolver en efectivo; {@code null} si no se registró el monto recibido. */
    public BigDecimal getCambio() {
        return montoRecibido == null ? null : montoRecibido.subtract(monto);
    }
}

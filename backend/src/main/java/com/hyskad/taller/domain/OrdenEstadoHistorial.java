package com.hyskad.taller.domain;

import java.time.Instant;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

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

/** RN-23: una transición de la orden con quién, cuándo y por qué. La creación no tiene estado anterior. */
@Entity
@Table(name = "orden_estado_historial")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class OrdenEstadoHistorial {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "orden_id", nullable = false, updatable = false)
    private OrdenTrabajo orden;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "estado_anterior", updatable = false, length = 25)
    private EstadoOrden estadoAnterior;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "estado_nuevo", nullable = false, updatable = false, length = 25)
    private EstadoOrden estadoNuevo;

    @Column(updatable = false, length = 500)
    private String nota;

    @Column(name = "usuario_id", updatable = false)
    private Long usuarioId;

    @Column(nullable = false, updatable = false)
    private Instant fecha;

    OrdenEstadoHistorial(OrdenTrabajo orden, EstadoOrden estadoAnterior, EstadoOrden estadoNuevo, String nota,
            Long usuarioId, Instant fecha) {
        this.orden = orden;
        this.estadoAnterior = estadoAnterior;
        this.estadoNuevo = estadoNuevo;
        this.nota = nota;
        this.usuarioId = usuarioId;
        this.fecha = fecha;
    }
}

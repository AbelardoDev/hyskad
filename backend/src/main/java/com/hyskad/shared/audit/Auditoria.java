package com.hyskad.shared.audit;

import java.time.Instant;
import java.util.Map;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** Registro inmutable de una acción relevante (RF31). Solo se inserta. */
@Entity
@Table(name = "auditoria")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Auditoria {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "usuario_id", updatable = false)
    private Long usuarioId;

    @Column(nullable = false, updatable = false, length = 60)
    private String accion;

    @Column(nullable = false, updatable = false, length = 60)
    private String entidad;

    @Column(name = "entidad_id", updatable = false)
    private Long entidadId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(updatable = false)
    private Map<String, Object> detalle;

    @Column(updatable = false, length = 45)
    private String ip;

    @Column(nullable = false, updatable = false)
    private Instant fecha;

    Auditoria(Long usuarioId, String accion, String entidad, Long entidadId, Map<String, Object> detalle,
            String ip, Instant fecha) {
        this.usuarioId = usuarioId;
        this.accion = accion;
        this.entidad = entidad;
        this.entidadId = entidadId;
        this.detalle = detalle;
        this.ip = ip;
        this.fecha = fecha;
    }
}

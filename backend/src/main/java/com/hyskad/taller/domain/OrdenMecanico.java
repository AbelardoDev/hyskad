package com.hyskad.taller.domain;

import java.io.Serializable;
import java.time.Instant;
import java.util.Objects;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MapsId;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** Mecánico asignado a una orden (RF12, RN-26), con la actividad que le toca (opcional). */
@Entity
@Table(name = "orden_mecanico")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class OrdenMecanico {

    @EmbeddedId
    private Id id;

    @MapsId("ordenId")
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "orden_id")
    private OrdenTrabajo orden;

    @Column(length = 200)
    private String actividad;

    @Column(name = "asignado_en", nullable = false, updatable = false)
    private Instant asignadoEn;

    OrdenMecanico(OrdenTrabajo orden, Long mecanicoId, String actividad, Instant asignadoEn) {
        this.id = new Id(null, mecanicoId);
        this.orden = orden;
        this.actividad = actividad;
        this.asignadoEn = asignadoEn;
    }

    public Long getMecanicoId() {
        return id.mecanicoId;
    }

    void cambiarActividad(String actividad) {
        this.actividad = actividad;
    }

    /** PK (orden_id, mecanico_id). */
    @Embeddable
    @Getter
    @NoArgsConstructor(access = AccessLevel.PROTECTED)
    public static class Id implements Serializable {

        private static final long serialVersionUID = 1L;

        @Column(name = "orden_id")
        private Long ordenId;

        @Column(name = "mecanico_id")
        private Long mecanicoId;

        Id(Long ordenId, Long mecanicoId) {
            this.ordenId = ordenId;
            this.mecanicoId = mecanicoId;
        }

        @Override
        public boolean equals(Object otro) {
            return otro instanceof Id o && Objects.equals(ordenId, o.ordenId)
                    && Objects.equals(mecanicoId, o.mecanicoId);
        }

        @Override
        public int hashCode() {
            return Objects.hash(ordenId, mecanicoId);
        }
    }
}

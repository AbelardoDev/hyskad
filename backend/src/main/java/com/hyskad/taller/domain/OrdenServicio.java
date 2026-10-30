package com.hyskad.taller.domain;

import java.math.BigDecimal;
import java.time.Instant;

import com.hyskad.servicios.domain.Servicio;

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
 * Servicio de la orden (RF15, RN-30): del catálogo con su precio base editable, o mano de obra
 * libre (sin servicio). Cuenta una vez en los totales.
 */
@Entity
@Table(name = "orden_servicio")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class OrdenServicio {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "orden_id", nullable = false, updatable = false)
    private OrdenTrabajo orden;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "servicio_id", updatable = false)
    private Servicio servicio;

    @Column(nullable = false, length = 200)
    private String descripcion;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal precio;

    @Column(name = "tiempo_min")
    private Integer tiempoMin;

    @Column(name = "mecanico_id")
    private Long mecanicoId;

    @Column(name = "agregado_por", updatable = false)
    private Long agregadoPor;

    @Column(name = "agregado_en", nullable = false, updatable = false)
    private Instant agregadoEn;

    OrdenServicio(OrdenTrabajo orden, Servicio servicio, DatosServicioOrden datos, Long agregadoPor,
            Instant agregadoEn) {
        this.orden = orden;
        this.servicio = servicio;
        this.agregadoPor = agregadoPor;
        this.agregadoEn = agregadoEn;
        actualizar(datos);
    }

    void actualizar(DatosServicioOrden datos) {
        this.descripcion = datos.descripcion();
        this.precio = datos.precio();
        this.tiempoMin = datos.tiempoMin();
        this.mecanicoId = datos.mecanicoId();
    }
}

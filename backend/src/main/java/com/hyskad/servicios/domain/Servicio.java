package com.hyskad.servicios.domain;

import java.math.BigDecimal;

import com.hyskad.shared.persistence.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * Servicio del catálogo del taller (RF16): nombre único, precio base y tiempo estimado. En la
 * orden el precio base es editable (RN-30); aquí solo es la referencia. Se desactiva, no se borra.
 */
@Entity
@Table(name = "servicio")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Servicio extends BaseEntity {

    @Column(nullable = false, unique = true, length = 120)
    private String nombre;

    @Column(length = 500)
    private String descripcion;

    @Column(name = "precio_base", nullable = false, precision = 15, scale = 2)
    private BigDecimal precioBase;

    @Column(name = "tiempo_estimado_min", nullable = false)
    private int tiempoEstimadoMin;

    @Column(nullable = false)
    private boolean activo;

    public Servicio(DatosServicio datos) {
        actualizar(datos);
        this.activo = true;
    }

    public void actualizar(DatosServicio datos) {
        this.nombre = datos.nombre();
        this.descripcion = datos.descripcion();
        this.precioBase = datos.precioBase();
        this.tiempoEstimadoMin = datos.tiempoEstimadoMin();
    }

    public void cambiarEstado(boolean activo) {
        this.activo = activo;
    }
}

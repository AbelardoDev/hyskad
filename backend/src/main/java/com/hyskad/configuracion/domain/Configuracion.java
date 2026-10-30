package com.hyskad.configuracion.domain;

import com.hyskad.shared.persistence.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** Parámetro del sistema como par clave/valor (iva.porcentaje, taller.nombre...). */
@Entity
@Table(name = "configuracion")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Configuracion extends BaseEntity {

    @Column(nullable = false, unique = true, length = 100, updatable = false)
    private String clave;

    @Column(nullable = false, length = 1000)
    private String valor;

    @Column(length = 255)
    private String descripcion;

    public void cambiarValor(String valor) {
        this.valor = valor;
    }
}

package com.hyskad.motocicletas.domain;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import com.hyskad.clientes.domain.Cliente;
import com.hyskad.shared.persistence.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * Motocicleta de un cliente (RF7, RF8). Placa normalizada y única (RN-41), VIN opcional y único
 * (RN-42). Puede cambiar de propietario conservando su historial (RN-43).
 */
@Entity
@Table(name = "motocicleta")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Motocicleta extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "cliente_id", nullable = false)
    private Cliente cliente;

    @Column(nullable = false, unique = true, length = 6)
    private String placa;

    @Column(nullable = false, length = 60)
    private String marca;

    @Column(nullable = false, length = 60)
    private String modelo;

    @JdbcTypeCode(SqlTypes.SMALLINT)
    private Integer anio;

    @Column(unique = true, length = 17)
    private String vin;

    @Column(name = "cilindrada_cc")
    private Integer cilindradaCc;

    @Column(length = 40)
    private String color;

    @Column(nullable = false)
    private boolean activo;

    public Motocicleta(Cliente cliente, DatosMotocicleta datos) {
        this.cliente = cliente;
        actualizar(datos);
        this.activo = true;
    }

    public void actualizar(DatosMotocicleta datos) {
        this.placa = datos.placa();
        this.marca = datos.marca();
        this.modelo = datos.modelo();
        this.anio = datos.anio();
        this.vin = datos.vin();
        this.cilindradaCc = datos.cilindradaCc();
        this.color = datos.color();
    }

    /** RN-43: la moto pasa a otro cliente; su historial de órdenes sigue con ella. */
    public void cambiarPropietario(Cliente nuevo) {
        this.cliente = nuevo;
    }

    public void cambiarEstado(boolean activo) {
        this.activo = activo;
    }
}

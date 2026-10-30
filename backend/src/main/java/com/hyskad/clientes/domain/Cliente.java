package com.hyskad.clientes.domain;

import java.time.Instant;

import org.hibernate.annotations.Formula;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import com.hyskad.shared.persistence.BaseEntity;
import com.hyskad.shared.validation.TipoDocumento;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * Cliente del taller (RF5). Persona natural (nombres y apellidos) o, con NIT, empresa (razón
 * social, RN-39). Documento único por tipo (RN-40); la autorización de datos sigue la Ley 1581
 * (RN-45).
 */
@Entity
@Table(name = "cliente")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Cliente extends BaseEntity {

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "tipo_documento", nullable = false, length = 5)
    private TipoDocumento tipoDocumento;

    @Column(name = "numero_documento", nullable = false, length = 20)
    private String numeroDocumento;

    @Column(length = 80)
    private String nombres;

    @Column(length = 80)
    private String apellidos;

    @Column(name = "razon_social", length = 150)
    private String razonSocial;

    @Column(nullable = false, length = 10)
    private String telefono;

    @Column(length = 254)
    private String email;

    @Column(length = 200)
    private String direccion;

    @Column(length = 80)
    private String ciudad;

    @Column(name = "acepta_tratamiento_datos", nullable = false)
    private boolean aceptaTratamientoDatos;

    @Column(name = "fecha_aceptacion_datos")
    private Instant fechaAceptacionDatos;

    @Column(nullable = false)
    private boolean activo;

    /** Nombre para mostrar y ordenar: razón social o nombres y apellidos. */
    @Formula("coalesce(razon_social, concat_ws(' ', nombres, apellidos))")
    private String nombreCompleto;

    /**
     * Motos activas del cliente. Subconsulta SQL para no depender del módulo
     * {@code motocicletas} (que depende de este).
     */
    @Formula("(select count(*) from motocicleta m where m.cliente_id = id and m.activo = true)")
    private long cantidadMotos;

    public Cliente(DatosCliente datos, Instant ahora) {
        actualizar(datos, ahora);
        this.activo = true;
    }

    /**
     * Reemplaza los datos. La fecha de aceptación se fija cuando el cliente autoriza y se borra si
     * retira la autorización; si ya había autorizado se conserva la fecha original.
     */
    public void actualizar(DatosCliente datos, Instant ahora) {
        this.tipoDocumento = datos.tipoDocumento();
        this.numeroDocumento = datos.numeroDocumento();
        boolean esEmpresa = datos.tipoDocumento() == TipoDocumento.NIT;
        this.razonSocial = esEmpresa ? datos.razonSocial() : null;
        this.nombres = esEmpresa ? null : datos.nombres();
        this.apellidos = esEmpresa ? null : datos.apellidos();
        this.telefono = datos.telefono();
        this.email = datos.email();
        this.direccion = datos.direccion();
        this.ciudad = datos.ciudad();
        if (datos.aceptaTratamientoDatos() && !this.aceptaTratamientoDatos) {
            this.fechaAceptacionDatos = ahora;
        } else if (!datos.aceptaTratamientoDatos()) {
            this.fechaAceptacionDatos = null;
        }
        this.aceptaTratamientoDatos = datos.aceptaTratamientoDatos();
        this.nombreCompleto = esEmpresa ? razonSocial : nombres + " " + apellidos;
    }

    public void cambiarEstado(boolean activo) {
        this.activo = activo;
    }

    /** RN-45: sin autorización de tratamiento de datos no se le envían correos. */
    public boolean puedeRecibirCorreos() {
        return aceptaTratamientoDatos && email != null;
    }
}

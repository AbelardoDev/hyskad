package com.hyskad.proveedores.domain;

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

/** Proveedor de repuestos (RF20). Documento único por tipo (RN-40); se desactiva, no se borra. */
@Entity
@Table(name = "proveedor")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Proveedor extends BaseEntity {

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "tipo_documento", nullable = false, length = 5)
    private TipoDocumento tipoDocumento;

    @Column(name = "numero_documento", nullable = false, length = 20)
    private String numeroDocumento;

    @Column(name = "razon_social", nullable = false, length = 150)
    private String razonSocial;

    @Column(length = 120)
    private String contacto;

    @Column(length = 10)
    private String telefono;

    @Column(length = 254)
    private String email;

    @Column(length = 200)
    private String direccion;

    @Column(nullable = false)
    private boolean activo;

    public Proveedor(DatosProveedor datos) {
        actualizar(datos);
        this.activo = true;
    }

    public void actualizar(DatosProveedor datos) {
        this.tipoDocumento = datos.tipoDocumento();
        this.numeroDocumento = datos.numeroDocumento();
        this.razonSocial = datos.razonSocial();
        this.contacto = datos.contacto();
        this.telefono = datos.telefono();
        this.email = datos.email();
        this.direccion = datos.direccion();
    }

    public void cambiarEstado(boolean activo) {
        this.activo = activo;
    }
}

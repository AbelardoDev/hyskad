package com.hyskad.usuarios.domain;

import java.time.Instant;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import com.hyskad.shared.persistence.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** Usuario interno del sistema (RF1). Sin autorregistro: lo crea un administrador (RN-46). */
@Entity
@Table(name = "usuario")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Usuario extends BaseEntity {

    @Column(nullable = false, length = 120)
    private String nombre;

    @Column(nullable = false, unique = true, length = 254)
    private String email;

    @Column(length = 20)
    private String telefono;

    @Column(name = "password_hash", nullable = false, length = 100)
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(nullable = false, length = 20)
    private Rol rol;

    @Column(nullable = false)
    private boolean activo;

    @Column(nullable = false, length = 5)
    private String idioma;

    @Column(name = "ultimo_acceso")
    private Instant ultimoAcceso;

    @Column(name = "debe_cambiar_password", nullable = false)
    private boolean debeCambiarPassword;

    public Usuario(String nombre, String email, String telefono, String passwordHash, Rol rol, String idioma,
            boolean debeCambiarPassword) {
        this.nombre = nombre;
        this.email = email;
        this.telefono = telefono;
        this.passwordHash = passwordHash;
        this.rol = rol;
        this.idioma = idioma;
        this.activo = true;
        this.debeCambiarPassword = debeCambiarPassword;
    }

    public void actualizarDatos(String nombre, String email, String telefono, Rol rol) {
        this.nombre = nombre;
        this.email = email;
        this.telefono = telefono;
        this.rol = rol;
    }

    public void cambiarEstado(boolean activo) {
        this.activo = activo;
    }

    public void cambiarIdioma(String idioma) {
        this.idioma = idioma;
    }

    /** Guarda el hash de una contraseña elegida por el propio usuario: ya no debe cambiarla. */
    public void cambiarPassword(String passwordHash) {
        this.passwordHash = passwordHash;
        this.debeCambiarPassword = false;
    }

    public void registrarAcceso(Instant momento) {
        this.ultimoAcceso = momento;
    }

    public boolean esAdmin() {
        return rol == Rol.ADMIN;
    }
}

package com.hyskad.usuarios.domain;

import java.io.Serializable;
import java.time.Instant;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** Ajuste de un usuario sobre los permisos de su rol (RF4): concede ({@code true}) o retira uno. */
@Entity
@Table(name = "usuario_permiso")
@IdClass(UsuarioPermiso.Clave.class)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class UsuarioPermiso {

    @Id
    @Column(name = "usuario_id")
    private Long usuarioId;

    @Id
    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(length = 60)
    private Permiso permiso;

    @Column(nullable = false)
    private boolean concedido;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public UsuarioPermiso(Long usuarioId, Permiso permiso, boolean concedido, Instant createdAt) {
        this.usuarioId = usuarioId;
        this.permiso = permiso;
        this.concedido = concedido;
        this.createdAt = createdAt;
    }

    /** Clave compuesta (usuario_id, permiso). */
    @EqualsAndHashCode
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Clave implements Serializable {
        private Long usuarioId;
        private Permiso permiso;
    }
}

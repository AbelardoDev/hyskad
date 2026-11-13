package com.hyskad.notificaciones.domain;

import java.time.Instant;
import java.util.Map;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * Notificación interna de un usuario (RF30). Guarda claves de i18n y parámetros, no texto, para
 * mostrarse en el idioma de quien la lee. Lo único que cambia después de crearla es {@code leida}.
 */
@Entity
@Table(name = "notificacion")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Notificacion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "usuario_id", nullable = false, updatable = false)
    private Long usuarioId;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(nullable = false, updatable = false, length = 40)
    private TipoNotificacion tipo;

    @Column(name = "titulo_clave", nullable = false, updatable = false, length = 120)
    private String tituloClave;

    @Column(name = "mensaje_clave", nullable = false, updatable = false, length = 120)
    private String mensajeClave;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(updatable = false)
    private Map<String, Object> parametros;

    @Column(updatable = false, length = 200)
    private String enlace;

    @Column(nullable = false)
    private boolean leida;

    @Column(nullable = false, updatable = false)
    private Instant fecha;

    public Notificacion(Long usuarioId, TipoNotificacion tipo, Map<String, Object> parametros, String enlace,
            Instant fecha) {
        this.usuarioId = usuarioId;
        this.tipo = tipo;
        this.tituloClave = tipo.tituloClave();
        this.mensajeClave = tipo.mensajeClave();
        this.parametros = parametros == null || parametros.isEmpty() ? null : Map.copyOf(parametros);
        this.enlace = enlace;
        this.fecha = fecha;
    }

    public void marcarLeida() {
        this.leida = true;
    }
}

package com.hyskad.auth.domain;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** Enlace de recuperación de contraseña (RF35, RN-50): un solo uso y vigencia corta. Solo se guarda su SHA-256. */
@Entity
@Table(name = "token_recuperacion")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class TokenRecuperacion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "usuario_id", nullable = false, updatable = false)
    private Long usuarioId;

    @Column(name = "token_hash", nullable = false, unique = true, updatable = false, length = 64)
    private String tokenHash;

    @Column(name = "expira_en", nullable = false, updatable = false)
    private Instant expiraEn;

    @Column(name = "usado_en")
    private Instant usadoEn;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public TokenRecuperacion(Long usuarioId, String tokenHash, Instant creadoEn, Instant expiraEn) {
        this.usuarioId = usuarioId;
        this.tokenHash = tokenHash;
        this.createdAt = creadoEn;
        this.expiraEn = expiraEn;
    }

    public boolean esUsable(Instant ahora) {
        return usadoEn == null && expiraEn.isAfter(ahora);
    }

    public void usar(Instant ahora) {
        usadoEn = ahora;
    }
}

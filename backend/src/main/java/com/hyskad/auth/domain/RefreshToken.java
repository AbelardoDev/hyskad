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

/**
 * Refresh token opaco (IC3). Solo se guarda su SHA-256. Cada uso lo revoca y apunta al que lo
 * reemplaza; presentar uno ya revocado indica posible robo.
 */
@Entity
@Table(name = "refresh_token")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class RefreshToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "usuario_id", nullable = false, updatable = false)
    private Long usuarioId;

    @Column(name = "token_hash", nullable = false, unique = true, updatable = false, length = 64)
    private String tokenHash;

    @Column(name = "expira_en", nullable = false, updatable = false)
    private Instant expiraEn;

    @Column(name = "revocado_en")
    private Instant revocadoEn;

    @Column(name = "reemplazado_por")
    private Long reemplazadoPor;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public RefreshToken(Long usuarioId, String tokenHash, Instant creadoEn, Instant expiraEn) {
        this.usuarioId = usuarioId;
        this.tokenHash = tokenHash;
        this.createdAt = creadoEn;
        this.expiraEn = expiraEn;
    }

    public boolean isRevocado() {
        return revocadoEn != null;
    }

    public boolean expiro(Instant ahora) {
        return !expiraEn.isAfter(ahora);
    }

    public void revocar(Instant ahora) {
        if (revocadoEn == null) {
            revocadoEn = ahora;
        }
    }

    /** Rotación: lo revoca y deja la traza de cuál lo reemplaza. */
    public void reemplazarPor(Long nuevoId, Instant ahora) {
        revocar(ahora);
        reemplazadoPor = nuevoId;
    }
}

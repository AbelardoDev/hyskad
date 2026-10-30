package com.hyskad.auth.persistence;

import java.time.Instant;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.hyskad.auth.domain.TokenRecuperacion;

import jakarta.persistence.LockModeType;

public interface TokenRecuperacionRepository extends JpaRepository<TokenRecuperacion, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<TokenRecuperacion> findByTokenHash(String tokenHash);

    /** Pedir un enlace nuevo invalida los anteriores sin usar (RN-50). */
    @Modifying
    @Query("update TokenRecuperacion t set t.usadoEn = :ahora where t.usuarioId = :usuarioId and t.usadoEn is null")
    int invalidarPendientes(@Param("usuarioId") Long usuarioId, @Param("ahora") Instant ahora);
}

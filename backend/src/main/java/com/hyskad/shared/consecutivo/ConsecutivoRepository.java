package com.hyskad.shared.consecutivo;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import jakarta.persistence.LockModeType;

interface ConsecutivoRepository extends JpaRepository<Consecutivo, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from Consecutivo c where c.tipo = :tipo")
    Optional<Consecutivo> bloquearPorTipo(TipoConsecutivo tipo);
}

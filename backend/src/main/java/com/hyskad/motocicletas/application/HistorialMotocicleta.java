package com.hyskad.motocicletas.application;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

/**
 * Pide al taller las órdenes de una moto (RF9) sin depender de él: {@code taller} depende de
 * {@code motocicletas}, así que la interfaz vive aquí y {@code taller} la implementa (igual que
 * {@code ConsultaOrdenesActivas}, ARCHITECTURE §6).
 */
public interface HistorialMotocicleta {

    /** Órdenes de la moto, la más reciente primero; las canceladas solo si {@code incluirCanceladas}. */
    Page<HistorialServicio> deMotocicleta(Long motocicletaId, boolean incluirCanceladas, Pageable pagina);
}

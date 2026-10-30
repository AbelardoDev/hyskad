package com.hyskad.clientes.application;

/**
 * Pregunta al taller si hay órdenes activas (RN-44) sin depender de él: {@code taller} depende de
 * {@code clientes} y {@code motocicletas}, así que la interfaz vive aquí y {@code taller} la
 * implementa (inversión de dependencias, ARCHITECTURE §6). Vive en {@code clientes} y no en
 * {@code motocicletas} porque ambos módulos la usan y {@code motocicletas} ya depende de
 * {@code clientes}.
 */
public interface ConsultaOrdenesActivas {

    boolean tieneOrdenActiva(Long motocicletaId);

    boolean clienteTieneOrdenesActivas(Long clienteId);
}

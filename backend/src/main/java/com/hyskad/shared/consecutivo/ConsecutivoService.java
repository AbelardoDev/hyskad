package com.hyskad.shared.consecutivo;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Numeración sin huecos por tipo de documento (RN-52). Bloquea la fila del consecutivo con
 * {@code PESSIMISTIC_WRITE} y exige la transacción del documento que se está creando: si esa
 * transacción se revierte, el número no se consume.
 */
@Service
public class ConsecutivoService {

    private final ConsecutivoRepository repository;

    public ConsecutivoService(ConsecutivoRepository repository) {
        this.repository = repository;
    }

    /** Devuelve el siguiente número formateado, ej. {@code OT-000001}. */
    @Transactional(propagation = Propagation.MANDATORY)
    public String siguiente(TipoConsecutivo tipo) {
        Consecutivo consecutivo = repository.bloquearPorTipo(tipo)
                .orElseThrow(() -> new IllegalStateException("No existe el consecutivo " + tipo));
        return formatear(tipo, consecutivo.tomar());
    }

    static String formatear(TipoConsecutivo tipo, long numero) {
        return "%s-%06d".formatted(tipo.prefijo(), numero);
    }
}

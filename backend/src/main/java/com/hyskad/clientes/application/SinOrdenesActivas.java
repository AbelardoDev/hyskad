package com.hyskad.clientes.application;

import org.springframework.stereotype.Component;

/**
 * Implementación provisional mientras no existe el módulo {@code taller}: nunca hay órdenes
 * activas. En F09A {@code taller} implementa {@link ConsultaOrdenesActivas} y esta clase se borra.
 */
@Component
class SinOrdenesActivas implements ConsultaOrdenesActivas {

    @Override
    public boolean tieneOrdenActiva(Long motocicletaId) {
        return false;
    }

    @Override
    public boolean clienteTieneOrdenesActivas(Long clienteId) {
        return false;
    }
}

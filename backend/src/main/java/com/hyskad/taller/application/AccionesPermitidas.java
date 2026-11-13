package com.hyskad.taller.application;

import java.util.List;

import com.hyskad.taller.domain.EstadoOrden;

/**
 * Lo que el usuario actual puede hacer con la orden según su estado, sus permisos y su asignación,
 * para que el frontend no repita esas reglas. Una transición con {@code bloqueo} existe para el
 * usuario pero aún no se cumple su condición (p. ej. {@code SIN_MECANICOS}). {@code registrarPago} y
 * {@code registrarEntrega} indican si el pago (RN-35) o la entrega (RN-36) están disponibles.
 */
public record AccionesPermitidas(boolean editar, boolean asignarMecanicos, boolean registrarDiagnostico,
        boolean editarItems, boolean gestionarPresupuestos, boolean registrarPago, boolean registrarEntrega,
        List<Transicion> transiciones) {

    public record Transicion(EstadoOrden estado, boolean requiereNota, String bloqueo) {
    }
}

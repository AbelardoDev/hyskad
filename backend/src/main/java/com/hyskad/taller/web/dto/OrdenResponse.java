package com.hyskad.taller.web.dto;

import java.time.Instant;
import java.util.List;

import com.hyskad.shared.validation.TipoDocumento;
import com.hyskad.taller.application.AccionesPermitidas;
import com.hyskad.taller.domain.EstadoOrden;

/**
 * Detalle de la orden con cliente, moto, mecánicos, historial de estados y lo que el usuario
 * actual puede hacer. {@code version} se devuelve en cada modificación (bloqueo optimista).
 */
public record OrdenResponse(Long id, String numero, EstadoOrden estado, long version, Instant fechaIngreso,
        int kilometrajeIngreso, String motivoIngreso, String descripcionProblema, String observaciones,
        String diagnostico, String observacionesDiagnostico, Integer kilometrajeInspeccion, ClienteResumen cliente,
        MotoResumen motocicleta, List<Mecanico> mecanicos, List<Historial> historial, UsuarioResumen creadaPor,
        AccionesPermitidas accionesPermitidas) {

    public record ClienteResumen(Long id, String nombreCompleto, TipoDocumento tipoDocumento,
            String numeroDocumento, String telefono) {
    }

    public record MotoResumen(Long id, String placa, String marca, String modelo, Integer anio, String color) {
    }

    public record Mecanico(Long id, String nombre, String actividad, Instant asignadoEn) {
    }

    public record Historial(EstadoOrden estadoAnterior, EstadoOrden estadoNuevo, String nota, UsuarioResumen usuario,
            Instant fecha) {
    }
}

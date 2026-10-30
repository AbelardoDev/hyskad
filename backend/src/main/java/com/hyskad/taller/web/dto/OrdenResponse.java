package com.hyskad.taller.web.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

import com.hyskad.catalogo.domain.Unidad;
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
        List<Servicio> servicios, List<Repuesto> repuestos, BigDecimal subtotal, BigDecimal descuento,
        BigDecimal ivaPorcentaje, BigDecimal impuesto, BigDecimal total, Instant fechaFinalizacion,
        AccionesPermitidas accionesPermitidas) {

    /** Servicio de la orden; {@code servicioId} nulo es mano de obra libre. */
    public record Servicio(Long id, Long servicioId, String descripcion, BigDecimal precio, Integer tiempoMin,
            UsuarioResumen mecanico) {
    }

    /** Repuesto reservado con el disponible actual del producto (sin costos). */
    public record Repuesto(Long id, Long productoId, String codigo, String nombre, Unidad unidad,
            BigDecimal cantidad, BigDecimal precioUnitario, BigDecimal subtotal, BigDecimal stockDisponible,
            BigDecimal stockMinimo) {
    }

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

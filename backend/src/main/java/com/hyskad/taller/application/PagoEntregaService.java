package com.hyskad.taller.application;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hyskad.configuracion.application.ConfiguracionService;
import com.hyskad.configuracion.application.DatosTaller;
import com.hyskad.shared.audit.AuditoriaService;
import com.hyskad.shared.dinero.MetodoPago;
import com.hyskad.shared.error.BusinessException;
import com.hyskad.shared.error.ConflictException;
import com.hyskad.shared.error.ErrorCampo;
import com.hyskad.shared.error.ErrorCode;
import com.hyskad.shared.security.UsuarioActual;
import com.hyskad.taller.domain.DatosPago;
import com.hyskad.taller.domain.EstadoOrden;
import com.hyskad.taller.domain.OrdenEntregada;
import com.hyskad.taller.domain.OrdenTrabajo;
import com.hyskad.taller.domain.Pago;

/**
 * Cierre de la orden (RF25, RF27, RF28): pago total y único (RN-35), entrega con pago (RN-36) y
 * comprobante. Como las decisiones de presupuesto, no reciben {@code version}: la orden se carga
 * con {@code OPTIMISTIC_FORCE_INCREMENT}, así dos pagos simultáneos no pasan ambos (y además lo
 * impide {@code uq_pago_orden}).
 */
@Service
public class PagoEntregaService {

    private final OrdenTrabajoService ordenes;
    private final ConfiguracionService configuracion;
    private final AuditoriaService auditoria;
    private final UsuarioActual usuarioActual;
    private final ApplicationEventPublisher eventos;
    private final Clock clock;

    public PagoEntregaService(OrdenTrabajoService ordenes, ConfiguracionService configuracion,
            AuditoriaService auditoria, UsuarioActual usuarioActual, ApplicationEventPublisher eventos, Clock clock) {
        this.ordenes = ordenes;
        this.configuracion = configuracion;
        this.auditoria = auditoria;
        this.usuarioActual = usuarioActual;
        this.eventos = eventos;
        this.clock = clock;
    }

    /** RN-35 y RN-20: orden finalizada sin pago, monto igual al total, referencia salvo en efectivo. */
    @Transactional
    public void registrarPago(Long ordenId, RegistrarPago datos) {
        OrdenTrabajo orden = ordenes.paraModificar(ordenId);
        String referencia = texto(datos.referencia());
        List<ErrorCampo> errores = new ArrayList<>();
        if (datos.metodo().requiereReferencia() && referencia == null) {
            errores.add(new ErrorCampo("referencia", "REFERENCIA_REQUERIDA"));
        }
        if (datos.metodo() == MetodoPago.EFECTIVO && datos.montoRecibido() != null
                && datos.montoRecibido().compareTo(datos.monto()) < 0) {
            errores.add(new ErrorCampo("montoRecibido", "MONTO_INSUFICIENTE"));
        }
        if (!errores.isEmpty()) {
            throw BusinessException.validacion(errores);
        }
        Pago pago = orden.registrarPago(new DatosPago(datos.monto(), datos.metodo(), referencia,
                datos.montoRecibido()), usuarioActual.id().orElse(null), Instant.now(clock));
        auditoria.registrar("ORDEN_PAGO_REGISTRADO", OrdenTrabajoService.ENTIDAD, orden.getId(), Map.of(
                "numero", orden.getNumero(), "monto", pago.getMonto(), "metodo", pago.getMetodo().name()));
    }

    /** RN-36: exige el pago, guarda la entrega y pasa la orden a {@code ENTREGADA}. */
    @Transactional
    public void registrarEntrega(Long ordenId, RegistrarEntrega datos) {
        OrdenTrabajo orden = ordenes.paraModificar(ordenId);
        Long usuarioId = usuarioActual.id().orElse(null);
        String observaciones = texto(datos.observaciones());
        orden.registrarEntrega(usuarioId, observaciones, Instant.now(clock));
        ordenes.aplicarTransicion(orden, EstadoOrden.ENTREGADA, observaciones);
        auditoria.registrar("ORDEN_ENTREGADA", OrdenTrabajoService.ENTIDAD, orden.getId(),
                Map.of("numero", orden.getNumero()));
        eventos.publishEvent(new OrdenEntregada(orden.getId(), orden.getNumero(), orden.getCliente().getId(),
                usuarioId));
    }

    /** RF27: comprobante de una orden pagada (visible para el usuario, RN-27). */
    @Transactional(readOnly = true)
    public Comprobante comprobante(Long ordenId) {
        OrdenTrabajoService.DetalleOrden detalle = ordenes.detalle(ordenId);
        OrdenTrabajo orden = detalle.orden();
        Pago pago = orden.getPago().orElseThrow(() -> new ConflictException(ErrorCode.PAGO_REQUERIDO,
                "La orden no tiene pago registrado"));
        return new Comprobante(orden, pago, configuracion.getDatosTaller());
    }

    private static String texto(String valor) {
        return valor == null || valor.isBlank() ? null : valor.trim();
    }

    public record Comprobante(OrdenTrabajo orden, Pago pago, DatosTaller taller) {
    }
}

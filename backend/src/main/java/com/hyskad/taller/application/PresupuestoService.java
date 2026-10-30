package com.hyskad.taller.application;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Map;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hyskad.configuracion.application.ConfiguracionService;
import com.hyskad.configuracion.application.DatosTaller;
import com.hyskad.shared.audit.AuditoriaService;
import com.hyskad.shared.consecutivo.ConsecutivoService;
import com.hyskad.shared.consecutivo.TipoConsecutivo;
import com.hyskad.shared.error.BusinessException;
import com.hyskad.shared.error.ErrorCampo;
import com.hyskad.shared.error.NotFoundException;
import com.hyskad.shared.security.UsuarioActual;
import com.hyskad.taller.domain.EstadoOrden;
import com.hyskad.taller.domain.EstadoPresupuesto;
import com.hyskad.taller.domain.OrdenTrabajo;
import com.hyskad.taller.domain.Presupuesto;
import com.hyskad.taller.domain.PresupuestoDecidido;
import com.hyskad.taller.domain.PresupuestoEnviado;
import com.hyskad.taller.persistence.PresupuestoRepository;

/**
 * Presupuestos (RF22, RF23, RN-31 a RN-34). Generar congela ítems y totales y pasa la orden a
 * {@code PENDIENTE_APROBACION}; aprobar la pasa a {@code EN_REPARACION} y rechazar la cancela
 * liberando sus reservas; retirar la devuelve a diagnóstico. Las transiciones y sus efectos los
 * aplica {@link OrdenTrabajoService}.
 */
@Service
public class PresupuestoService {

    static final String ENTIDAD = "presupuesto";

    private final PresupuestoRepository repository;
    private final OrdenTrabajoService ordenes;
    private final ConfiguracionService configuracion;
    private final ConsecutivoService consecutivos;
    private final AuditoriaService auditoria;
    private final UsuarioActual usuarioActual;
    private final ApplicationEventPublisher eventos;
    private final Clock clock;

    public PresupuestoService(PresupuestoRepository repository, OrdenTrabajoService ordenes,
            ConfiguracionService configuracion, ConsecutivoService consecutivos, AuditoriaService auditoria,
            UsuarioActual usuarioActual, ApplicationEventPublisher eventos, Clock clock) {
        this.repository = repository;
        this.ordenes = ordenes;
        this.configuracion = configuracion;
        this.consecutivos = consecutivos;
        this.auditoria = auditoria;
        this.usuarioActual = usuarioActual;
        this.eventos = eventos;
        this.clock = clock;
    }

    /** Todas las versiones de la orden, la más reciente primero (la orden debe ser visible). */
    @Transactional(readOnly = true)
    public List<Presupuesto> deOrden(Long ordenId) {
        ordenes.detalle(ordenId);
        return repository.findByOrdenIdOrderByVersionDesc(ordenId);
    }

    /** El presupuesto con los datos del taller, para imprimirlo. */
    @Transactional(readOnly = true)
    public Documento documento(Long id) {
        Long ordenId = repository.ordenDe(id).orElseThrow(() -> new NotFoundException(ENTIDAD, id));
        OrdenTrabajoService.DetalleOrden detalle = ordenes.detalle(ordenId);
        Presupuesto presupuesto = repository.findById(id).orElseThrow(() -> new NotFoundException(ENTIDAD, id));
        return new Documento(presupuesto, detalle.orden(), configuracion.getDatosTaller());
    }

    /**
     * RN-31, RN-32: exige diagnóstico y al menos un ítem (en {@code EN_DIAGNOSTICO}), aplica el
     * descuento, congela la orden en un presupuesto {@code P-000001} versión n+1 (reemplazando el
     * pendiente, si hay) y la pasa a {@code PENDIENTE_APROBACION}.
     */
    @Transactional
    public Presupuesto generar(Long ordenId, GenerarPresupuesto datos) {
        OrdenTrabajo orden = ordenes.paraModificar(ordenId, datos.version());
        EstadoOrden desde = orden.getEstado();
        if (desde != EstadoOrden.EN_DIAGNOSTICO) {
            throw OrdenTrabajo.transicionInvalida(desde, EstadoOrden.PENDIENTE_APROBACION, null);
        }
        OrdenTrabajoService.bloqueo(orden, EstadoOrden.PENDIENTE_APROBACION).ifPresent(motivo -> {
            throw OrdenTrabajo.transicionInvalida(desde, EstadoOrden.PENDIENTE_APROBACION, motivo);
        });
        orden.recalcular(configuracion.getIvaPorcentaje());
        if (datos.descuento().compareTo(orden.getSubtotal()) > 0) {
            throw BusinessException.validacion(List.of(new ErrorCampo("descuento", "DESCUENTO_INVALIDO")));
        }
        orden.aplicarDescuento(datos.descuento(), configuracion.getIvaPorcentaje());

        Long usuarioId = usuarioActual.id().orElse(null);
        Instant ahora = Instant.now(clock);
        repository.findFirstByOrdenIdAndEstado(ordenId, EstadoPresupuesto.PENDIENTE)
                .ifPresent(p -> p.reemplazar(usuarioId, ahora));
        Presupuesto presupuesto = repository.save(new Presupuesto(orden, consecutivos.siguiente(TipoConsecutivo.PRESUPUESTO),
                repository.ultimaVersion(ordenId) + 1, texto(datos.observaciones()), usuarioId, ahora));
        ordenes.aplicarTransicion(orden, EstadoOrden.PENDIENTE_APROBACION, presupuesto.getNumero());

        auditoria.registrar("PRESUPUESTO_ENVIADO", ENTIDAD, presupuesto.getId(), Map.of("numero",
                presupuesto.getNumero(), "ordenId", ordenId, "version", presupuesto.getVersion(),
                "total", presupuesto.getTotal()));
        eventos.publishEvent(new PresupuestoEnviado(presupuesto.getId(), presupuesto.getNumero(), ordenId,
                orden.getCliente().getId(), presupuesto.getTotal()));
        return presupuesto;
    }

    /**
     * RN-33: aprobado → la orden pasa a {@code EN_REPARACION}; rechazado → se cancela y libera todas
     * sus reservas. Dos decisiones simultáneas no pasan ambas (la orden sube de versión).
     */
    @Transactional
    public Presupuesto decidir(Long id, DecidirPresupuesto datos) {
        if (datos.decision() != EstadoPresupuesto.APROBADO && datos.decision() != EstadoPresupuesto.RECHAZADO) {
            throw BusinessException.validacion(List.of(new ErrorCampo("decision", "DECISION_INVALIDA")));
        }
        Presupuesto presupuesto = paraModificar(id);
        String observaciones = texto(datos.observaciones());
        presupuesto.decidir(datos.decision(), observaciones, usuarioActual.id().orElse(null), Instant.now(clock));
        boolean aprobado = datos.decision() == EstadoPresupuesto.APROBADO;
        ordenes.aplicarTransicion(presupuesto.getOrden(),
                aprobado ? EstadoOrden.EN_REPARACION : EstadoOrden.CANCELADA,
                observaciones == null ? presupuesto.getNumero() : presupuesto.getNumero() + ": " + observaciones);
        auditoria.registrar(aprobado ? "PRESUPUESTO_APROBADO" : "PRESUPUESTO_RECHAZADO", ENTIDAD, id,
                Map.of("numero", presupuesto.getNumero(), "ordenId", presupuesto.getOrden().getId()));
        eventos.publishEvent(new PresupuestoDecidido(id, presupuesto.getNumero(), presupuesto.getOrden().getId(),
                datos.decision(), usuarioActual.id().orElse(null)));
        return presupuesto;
    }

    /** Retira el presupuesto pendiente para ajustarlo: queda {@code REEMPLAZADO} y la orden vuelve a diagnóstico. */
    @Transactional
    public Presupuesto retirar(Long id) {
        Presupuesto presupuesto = paraModificar(id);
        presupuesto.exigirPendiente();
        ordenes.aplicarTransicion(presupuesto.getOrden(), EstadoOrden.EN_DIAGNOSTICO, presupuesto.getNumero());
        return presupuesto;
    }

    /** La orden del presupuesto, visible para el usuario y bloqueada para que suba de versión. */
    private Presupuesto paraModificar(Long id) {
        Long ordenId = repository.ordenDe(id).orElseThrow(() -> new NotFoundException(ENTIDAD, id));
        OrdenTrabajo orden = ordenes.paraModificar(ordenId);
        Presupuesto presupuesto = repository.findById(id).orElseThrow(() -> new NotFoundException(ENTIDAD, id));
        if (!presupuesto.getOrden().getId().equals(orden.getId())) {
            throw new NotFoundException(ENTIDAD, id);
        }
        return presupuesto;
    }

    private static String texto(String valor) {
        return valor == null || valor.isBlank() ? null : valor.trim();
    }

    /** El presupuesto, su orden (cliente y moto) y los datos del taller para el documento. */
    public record Documento(Presupuesto presupuesto, OrdenTrabajo orden, DatosTaller taller) {
    }
}

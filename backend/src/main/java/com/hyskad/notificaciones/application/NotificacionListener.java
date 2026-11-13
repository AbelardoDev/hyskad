package com.hyskad.notificaciones.application;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import com.hyskad.inventario.domain.StockBajoDetectado;
import com.hyskad.notificaciones.domain.TipoNotificacion;
import com.hyskad.taller.application.OrdenParaAvisos;
import com.hyskad.taller.application.OrdenTrabajoService;
import com.hyskad.taller.domain.EstadoOrdenCambiado;
import com.hyskad.taller.domain.EstadoPresupuesto;
import com.hyskad.taller.domain.MecanicoAsignado;
import com.hyskad.taller.domain.OrdenCreada;
import com.hyskad.taller.domain.OrdenEntregada;
import com.hyskad.taller.domain.OrdenFinalizada;
import com.hyskad.taller.domain.PresupuestoDecidido;
import com.hyskad.taller.domain.PresupuestoEnviado;
import com.hyskad.usuarios.application.UsuarioService;
import com.hyskad.usuarios.domain.Rol;
import com.hyskad.ventas.domain.VentaAnulada;

/**
 * Observer de los eventos de dominio (BUSINESS-RULES §9, ARCHITECTURE §6): decide a quién avisar y
 * crea las notificaciones. Corre después del commit y en otro hilo, así que un evento de una
 * transacción revertida no notifica y un fallo aquí no afecta la operación. Nunca se avisa a quien
 * hizo la acción, ni a usuarios inactivos.
 */
@Component
public class NotificacionListener {

    private final NotificacionService notificaciones;
    private final OrdenTrabajoService ordenes;
    private final UsuarioService usuarios;

    public NotificacionListener(NotificacionService notificaciones, OrdenTrabajoService ordenes,
            UsuarioService usuarios) {
        this.notificaciones = notificaciones;
        this.ordenes = ordenes;
        this.usuarios = usuarios;
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void alCrearOrden(OrdenCreada e) {
        OrdenParaAvisos orden = ordenes.paraAvisos(e.ordenId());
        avisar(TipoNotificacion.ORDEN_CREADA, usuarios.idsActivosConRol(Rol.VENDEDOR, Rol.ADMIN), e.creadaPor(),
                deOrden(orden), enlaceOrden(e.ordenId()));
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void alAsignarMecanico(MecanicoAsignado e) {
        OrdenParaAvisos orden = ordenes.paraAvisos(e.ordenId());
        avisar(TipoNotificacion.MECANICO_ASIGNADO, usuarios.idsActivos(List.of(e.mecanicoId())), e.asignadoPor(),
                deOrden(orden), enlaceOrden(e.ordenId()));
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void alCambiarEstado(EstadoOrdenCambiado e) {
        OrdenParaAvisos orden = ordenes.paraAvisos(e.ordenId());
        List<Long> interesados = new ArrayList<>(orden.mecanicos());
        if (orden.creadaPor() != null) {
            interesados.add(orden.creadaPor());
        }
        Map<String, Object> parametros = Map.of("numero", orden.numero(), "placa", orden.placa(),
                "estado", e.nuevo().name());
        avisar(TipoNotificacion.ESTADO_ORDEN_CAMBIADO, usuarios.idsActivos(interesados), e.usuarioId(), parametros,
                enlaceOrden(e.ordenId()));
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void alEnviarPresupuesto(PresupuestoEnviado e) {
        OrdenParaAvisos orden = ordenes.paraAvisos(e.ordenId());
        avisar(TipoNotificacion.PRESUPUESTO_ENVIADO, usuarios.idsActivosConRol(Rol.VENDEDOR), e.enviadoPor(),
                Map.of("numero", orden.numero(), "placa", orden.placa(), "presupuesto", e.numero()),
                enlaceOrden(e.ordenId()));
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void alDecidirPresupuesto(PresupuestoDecidido e) {
        OrdenParaAvisos orden = ordenes.paraAvisos(e.ordenId());
        TipoNotificacion tipo = e.decision() == EstadoPresupuesto.APROBADO ? TipoNotificacion.PRESUPUESTO_APROBADO
                : TipoNotificacion.PRESUPUESTO_RECHAZADO;
        avisar(tipo, usuarios.idsActivos(orden.mecanicos()), e.decididoPor(),
                Map.of("numero", orden.numero(), "placa", orden.placa(), "presupuesto", e.numero()),
                enlaceOrden(e.ordenId()));
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void alFinalizarOrden(OrdenFinalizada e) {
        OrdenParaAvisos orden = ordenes.paraAvisos(e.ordenId());
        avisar(TipoNotificacion.ORDEN_FINALIZADA, usuarios.idsActivosConRol(Rol.VENDEDOR, Rol.ADMIN), null,
                deOrden(orden), enlaceOrden(e.ordenId()));
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void alEntregarOrden(OrdenEntregada e) {
        OrdenParaAvisos orden = ordenes.paraAvisos(e.ordenId());
        avisar(TipoNotificacion.ORDEN_ENTREGADA, usuarios.idsActivosConRol(Rol.ADMIN), e.entregadaPor(),
                deOrden(orden), enlaceOrden(e.ordenId()));
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void alDetectarStockBajo(StockBajoDetectado e) {
        avisar(TipoNotificacion.STOCK_BAJO, usuarios.idsActivosConRol(Rol.ALMACEN, Rol.ADMIN), null,
                Map.of("codigo", e.codigo(), "nombre", e.nombre(), "disponible", e.stockDisponible().stripTrailingZeros()
                        .toPlainString()),
                "/inventario/productos/" + e.productoId());
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void alAnularVenta(VentaAnulada e) {
        avisar(TipoNotificacion.VENTA_ANULADA, usuarios.idsActivosConRol(Rol.ADMIN), e.anuladaPor(),
                Map.of("numero", e.numero()), "/ventas/" + e.ventaId());
    }

    private void avisar(TipoNotificacion tipo, Collection<Long> candidatos, Long autor, Map<String, Object> parametros,
            String enlace) {
        List<Long> destinatarios = candidatos.stream().filter(id -> !Objects.equals(id, autor)).distinct().toList();
        if (!destinatarios.isEmpty()) {
            notificaciones.notificar(tipo, destinatarios, parametros, enlace);
        }
    }

    private static Map<String, Object> deOrden(OrdenParaAvisos orden) {
        return Map.of("numero", orden.numero(), "placa", orden.placa());
    }

    private static String enlaceOrden(Long ordenId) {
        return "/ordenes/" + ordenId;
    }
}

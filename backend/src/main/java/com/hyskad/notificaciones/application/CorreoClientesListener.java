package com.hyskad.notificaciones.application;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.DecimalFormat;
import java.text.DecimalFormatSymbols;
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import com.hyskad.clientes.application.ClienteService;
import com.hyskad.clientes.domain.Cliente;
import com.hyskad.shared.config.TiempoConfig;
import com.hyskad.shared.correo.CorreoService;
import com.hyskad.taller.application.OrdenParaAvisos;
import com.hyskad.taller.application.OrdenTrabajoService;
import com.hyskad.taller.application.PresupuestoService;
import com.hyskad.taller.domain.OrdenCreada;
import com.hyskad.taller.domain.OrdenEntregada;
import com.hyskad.taller.domain.OrdenFinalizada;
import com.hyskad.taller.domain.PresupuestoEnviado;

/**
 * Correos a clientes (BUSINESS-RULES §9), en español: ingreso de la moto, presupuesto pendiente,
 * moto lista y entrega. Solo si el cliente tiene email y autorizó el tratamiento de sus datos
 * (RN-45). Corre después del commit y en otro hilo: un fallo del correo no toca la operación.
 */
@Component
public class CorreoClientesListener {

    static final Locale IDIOMA = Locale.forLanguageTag("es-CO");
    private static final DateTimeFormatter FECHA = DateTimeFormatter.ofPattern("dd/MM/yyyy h:mm a", IDIOMA)
            .withZone(TiempoConfig.ZONA_NEGOCIO);

    private final CorreoService correos;
    private final ClienteService clientes;
    private final OrdenTrabajoService ordenes;
    private final PresupuestoService presupuestos;

    public CorreoClientesListener(CorreoService correos, ClienteService clientes, OrdenTrabajoService ordenes,
            PresupuestoService presupuestos) {
        this.correos = correos;
        this.clientes = clientes;
        this.ordenes = ordenes;
        this.presupuestos = presupuestos;
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void alCrearOrden(OrdenCreada e) {
        OrdenParaAvisos orden = ordenes.paraAvisos(e.ordenId());
        enviar(orden.clienteId(), "orden-recibida", orden, Map.of("fecha", fecha(orden.fechaIngreso()),
                "motivo", orden.motivoIngreso()));
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void alEnviarPresupuesto(PresupuestoEnviado e) {
        OrdenParaAvisos presupuesto = presupuestos.paraAvisos(e.presupuestoId());
        Map<String, Object> extra = new HashMap<>(totales(presupuesto));
        extra.put("presupuesto", presupuesto.numero());
        extra.put("numero", ordenes.paraAvisos(e.ordenId()).numero());
        enviar(presupuesto.clienteId(), "presupuesto-pendiente", presupuesto, extra);
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void alFinalizarOrden(OrdenFinalizada e) {
        OrdenParaAvisos orden = ordenes.paraAvisos(e.ordenId());
        enviar(orden.clienteId(), "orden-lista", orden, Map.of("total", pesos(orden.total())));
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void alEntregarOrden(OrdenEntregada e) {
        OrdenParaAvisos orden = ordenes.paraAvisos(e.ordenId());
        Map<String, Object> extra = new HashMap<>(totales(orden));
        extra.put("fecha", fecha(orden.fechaEntrega()));
        extra.put("metodo", orden.pago() == null ? null : orden.pago().metodo());
        enviar(orden.clienteId(), "orden-entregada", orden, extra);
    }

    /** RN-45: sin email o sin autorización no se envía nada. */
    private void enviar(Long clienteId, String plantilla, OrdenParaAvisos orden, Map<String, Object> extra) {
        Cliente cliente = clientes.obtener(clienteId);
        if (!cliente.puedeRecibirCorreos()) {
            return;
        }
        Map<String, Object> variables = new HashMap<>();
        variables.put("nombre", cliente.getNombreCompleto());
        variables.put("numero", orden.numero());
        variables.put("placa", orden.placa());
        variables.put("moto", orden.moto());
        variables.putAll(extra);
        correos.enviar(cliente.getEmail(), plantilla, IDIOMA, variables);
    }

    /** Líneas y totales ya formateados en pesos (RN-01). */
    static Map<String, Object> totales(OrdenParaAvisos o) {
        Map<String, Object> t = new HashMap<>();
        List<Map<String, String>> lineas = o.lineas().stream().map(l -> Map.of("descripcion", l.descripcion(),
                "cantidad", l.cantidad().stripTrailingZeros().toPlainString(), "subtotal", pesos(l.subtotal())))
                .toList();
        t.put("lineas", lineas);
        t.put("subtotal", pesos(o.subtotal()));
        t.put("descuento", o.descuento().signum() > 0 ? pesos(o.descuento()) : null);
        t.put("iva", o.ivaPorcentaje().stripTrailingZeros().toPlainString());
        t.put("impuesto", pesos(o.impuesto()));
        t.put("total", pesos(o.total()));
        return t;
    }

    /** {@code $ 1.250.000}: sin decimales, HALF_UP y punto de miles (RN-01). */
    static String pesos(BigDecimal valor) {
        DecimalFormatSymbols simbolos = new DecimalFormatSymbols(IDIOMA);
        simbolos.setGroupingSeparator('.');
        DecimalFormat formato = new DecimalFormat("#,##0", simbolos);
        return "$ " + formato.format(valor.setScale(0, RoundingMode.HALF_UP));
    }

    static String fecha(Instant instante) {
        return instante == null ? "" : FECHA.format(instante);
    }
}

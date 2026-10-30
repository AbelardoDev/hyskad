package com.hyskad.taller.domain;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.hibernate.annotations.BatchSize;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import com.hyskad.catalogo.domain.Producto;
import com.hyskad.clientes.domain.Cliente;
import com.hyskad.motocicletas.domain.Motocicleta;
import com.hyskad.servicios.domain.Servicio;
import com.hyskad.shared.dinero.CalculadoraTotales;
import com.hyskad.shared.dinero.CalculadoraTotales.Totales;
import com.hyskad.shared.error.ConflictException;
import com.hyskad.shared.error.ErrorCode;
import com.hyskad.shared.error.NotFoundException;
import com.hyskad.shared.persistence.BaseEntity;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * Orden de trabajo del taller (RF10–RF14). Nace {@code RECIBIDA} (RN-25) y solo cambia de estado
 * con {@link #transicionarA}, que valida el diagrama de {@link EstadoOrden} y deja la fila del
 * historial (RN-23). {@code version} es el bloqueo optimista que el cliente devuelve al editar.
 */
@Entity
@Table(name = "orden_trabajo")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class OrdenTrabajo extends BaseEntity {

    @Column(nullable = false, unique = true, updatable = false, length = 20)
    private String numero;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "cliente_id", nullable = false, updatable = false)
    private Cliente cliente;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "motocicleta_id", nullable = false, updatable = false)
    private Motocicleta motocicleta;

    @Column(name = "fecha_ingreso", nullable = false, updatable = false)
    private Instant fechaIngreso;

    @Column(name = "kilometraje_ingreso", nullable = false, updatable = false)
    private int kilometrajeIngreso;

    @Column(name = "motivo_ingreso", nullable = false, length = 200)
    private String motivoIngreso;

    @Column(name = "descripcion_problema", nullable = false, length = 2000)
    private String descripcionProblema;

    @Column(length = 2000)
    private String observaciones;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(nullable = false, length = 25)
    private EstadoOrden estado;

    @Column(length = 4000)
    private String diagnostico;

    @Column(name = "observaciones_diagnostico", length = 2000)
    private String observacionesDiagnostico;

    @Column(name = "kilometraje_inspeccion")
    private Integer kilometrajeInspeccion;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal subtotal = BigDecimal.ZERO;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal descuento = BigDecimal.ZERO;

    @Column(name = "iva_porcentaje", nullable = false, precision = 5, scale = 2)
    private BigDecimal ivaPorcentaje = BigDecimal.ZERO;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal impuesto = BigDecimal.ZERO;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal total = BigDecimal.ZERO;

    @Column(name = "fecha_finalizacion")
    private Instant fechaFinalizacion;

    @Version
    private long version;

    @OneToMany(mappedBy = "orden", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("asignadoEn, id.mecanicoId")
    @BatchSize(size = 50)
    private List<OrdenMecanico> mecanicos = new ArrayList<>();

    @OneToMany(mappedBy = "orden", cascade = CascadeType.ALL)
    @OrderBy("fecha, id")
    private List<OrdenEstadoHistorial> historial = new ArrayList<>();

    @OneToMany(mappedBy = "orden", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("id")
    @BatchSize(size = 50)
    private List<OrdenServicio> servicios = new ArrayList<>();

    @OneToMany(mappedBy = "orden", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("id")
    @BatchSize(size = 50)
    private List<OrdenRepuesto> repuestos = new ArrayList<>();

    public OrdenTrabajo(String numero, Cliente cliente, Motocicleta motocicleta, int kilometrajeIngreso,
            DatosRecepcion recepcion, Long usuarioId, Instant ahora) {
        this.numero = numero;
        this.cliente = cliente;
        this.motocicleta = motocicleta;
        this.kilometrajeIngreso = kilometrajeIngreso;
        this.fechaIngreso = ahora;
        this.estado = EstadoOrden.RECIBIDA;
        aplicar(recepcion);
        historial.add(new OrdenEstadoHistorial(this, null, EstadoOrden.RECIBIDA, null, usuarioId, ahora));
    }

    /** Motivo, descripción y observaciones de la recepción; no se editan en una orden cerrada. */
    public void actualizarRecepcion(DatosRecepcion recepcion) {
        exigirActiva();
        aplicar(recepcion);
    }

    /**
     * RN-26: reemplaza los mecánicos asignados. Los que siguen conservan su fecha de asignación;
     * devuelve los ids que entraron y los que salieron.
     */
    public CambioMecanicos asignarMecanicos(List<Asignacion> asignaciones, Instant ahora) {
        exigirActiva();
        Map<Long, OrdenMecanico> actuales = mecanicos.stream()
                .collect(Collectors.toMap(OrdenMecanico::getMecanicoId, Function.identity()));
        Set<Long> nuevos = asignaciones.stream().map(Asignacion::mecanicoId).collect(Collectors.toSet());

        List<Long> quitados = actuales.keySet().stream().filter(id -> !nuevos.contains(id)).sorted().toList();
        mecanicos.removeIf(m -> quitados.contains(m.getMecanicoId()));
        List<Long> agregados = new ArrayList<>();
        for (Asignacion asignacion : asignaciones) {
            OrdenMecanico actual = actuales.get(asignacion.mecanicoId());
            if (actual == null) {
                mecanicos.add(new OrdenMecanico(this, asignacion.mecanicoId(), asignacion.actividad(), ahora));
                agregados.add(asignacion.mecanicoId());
            } else {
                actual.cambiarActividad(asignacion.actividad());
            }
        }
        return new CambioMecanicos(agregados, quitados);
    }

    /** RF14: se registra o corrige en diagnóstico o durante la reparación. */
    public void registrarDiagnostico(DatosDiagnostico datos) {
        if (estado != EstadoOrden.EN_DIAGNOSTICO && estado != EstadoOrden.EN_REPARACION) {
            throw new ConflictException(ErrorCode.ORDEN_ESTADO_INVALIDO,
                    "El diagnóstico se registra en diagnóstico o en reparación", Map.of("estado", estado.name()));
        }
        this.diagnostico = datos.diagnostico();
        this.observacionesDiagnostico = datos.observaciones();
        this.kilometrajeInspeccion = datos.kilometrajeInspeccion();
    }

    /**
     * RN-22 y RN-23: aplica la transición si el diagrama la permite y la deja en el historial. Las
     * condiciones de negocio (mecánicos, diagnóstico, pago...) las verifica antes quien llama.
     */
    public void transicionarA(EstadoOrden nuevo, Long usuarioId, String nota, Instant ahora) {
        if (!estado.puedeTransicionarA(nuevo)) {
            throw transicionInvalida(estado, nuevo, null);
        }
        historial.add(new OrdenEstadoHistorial(this, estado, nuevo, nota, usuarioId, ahora));
        this.estado = nuevo;
    }

    /** RN-30: servicio del catálogo ({@code servicio} no nulo) o mano de obra libre. */
    public OrdenServicio agregarServicio(Servicio servicio, DatosServicioOrden datos, Long usuarioId, Instant ahora) {
        exigirEditableItems();
        OrdenServicio item = new OrdenServicio(this, servicio, datos, usuarioId, ahora);
        servicios.add(item);
        recalcular(ivaPorcentaje);
        return item;
    }

    public OrdenServicio actualizarServicio(Long itemId, DatosServicioOrden datos) {
        exigirEditableItems();
        OrdenServicio item = servicio(itemId);
        item.actualizar(datos);
        recalcular(ivaPorcentaje);
        return item;
    }

    public OrdenServicio quitarServicio(Long itemId) {
        exigirEditableItems();
        OrdenServicio item = servicio(itemId);
        servicios.remove(item);
        recalcular(ivaPorcentaje);
        return item;
    }

    /**
     * RN-29: agrega el repuesto al precio vigente del producto o, si ya está en la orden, suma la
     * cantidad al mismo ítem (conserva el precio con que se agregó). Quien llama reserva la cantidad.
     */
    public OrdenRepuesto agregarRepuesto(Producto producto, BigDecimal cantidad, Long usuarioId, Instant ahora) {
        exigirEditableItems();
        OrdenRepuesto existente = repuestos.stream()
                .filter(r -> Objects.equals(r.getProducto().getId(), producto.getId())).findFirst().orElse(null);
        if (existente != null) {
            existente.cambiarCantidad(existente.getCantidad().add(cantidad));
            recalcular(ivaPorcentaje);
            return existente;
        }
        OrdenRepuesto item = new OrdenRepuesto(this, producto, cantidad, usuarioId, ahora);
        repuestos.add(item);
        recalcular(ivaPorcentaje);
        return item;
    }

    /** Cambia la cantidad y devuelve la diferencia (positiva: hay que reservar más; negativa: liberar). */
    public BigDecimal cambiarCantidadRepuesto(Long itemId, BigDecimal cantidad) {
        exigirEditableItems();
        OrdenRepuesto item = repuesto(itemId);
        BigDecimal diferencia = cantidad.subtract(item.getCantidad());
        item.cambiarCantidad(cantidad);
        recalcular(ivaPorcentaje);
        return diferencia;
    }

    /** Quita el repuesto; quien llama libera su reserva. */
    public OrdenRepuesto quitarRepuesto(Long itemId) {
        exigirEditableItems();
        OrdenRepuesto item = repuesto(itemId);
        repuestos.remove(item);
        recalcular(ivaPorcentaje);
        return item;
    }

    /** RN-32: el descuento lo fija el presupuesto; de 0 al subtotal (lo valida quien llama). */
    public void aplicarDescuento(BigDecimal descuento, BigDecimal ivaVigente) {
        this.descuento = descuento;
        recalcular(ivaVigente);
    }

    /**
     * RF24: totales con {@link CalculadoraTotales} (RN-04). Mientras no haya presupuesto la orden usa
     * el IVA vigente; el presupuesto lo congela. Si quitar ítems deja el subtotal bajo el descuento,
     * el descuento baja hasta el subtotal.
     */
    public void recalcular(BigDecimal iva) {
        this.ivaPorcentaje = iva;
        List<BigDecimal> lineas = new ArrayList<>();
        servicios.forEach(s -> lineas.add(s.getPrecio()));
        repuestos.forEach(r -> lineas.add(r.getSubtotal()));
        BigDecimal suma = lineas.stream().reduce(BigDecimal.ZERO, BigDecimal::add);
        Totales totales = CalculadoraTotales.calcular(lineas, descuento.min(suma), iva);
        this.subtotal = totales.subtotal();
        this.descuento = totales.descuento();
        this.impuesto = totales.impuesto();
        this.total = totales.total();
    }

    public void finalizar(Instant ahora) {
        this.fechaFinalizacion = ahora;
    }

    public boolean tieneItems() {
        return !servicios.isEmpty() || !repuestos.isEmpty();
    }

    public List<OrdenServicio> getServicios() {
        return Collections.unmodifiableList(servicios);
    }

    public List<OrdenRepuesto> getRepuestos() {
        return Collections.unmodifiableList(repuestos);
    }

    public static ConflictException transicionInvalida(EstadoOrden desde, EstadoOrden hasta, String motivo) {
        return new ConflictException(ErrorCode.TRANSICION_INVALIDA,
                "La orden no puede pasar de " + desde + " a " + hasta,
                motivo == null ? Map.of("desde", desde.name(), "hasta", hasta.name())
                        : Map.of("desde", desde.name(), "hasta", hasta.name(), "motivo", motivo));
    }

    public boolean estaAsignado(Long usuarioId) {
        return usuarioId != null && mecanicos.stream().anyMatch(m -> Objects.equals(m.getMecanicoId(), usuarioId));
    }

    public boolean tieneDiagnostico() {
        return diagnostico != null;
    }

    public boolean esActiva() {
        return !estado.esFinal();
    }

    public List<OrdenMecanico> getMecanicos() {
        return Collections.unmodifiableList(mecanicos);
    }

    public List<OrdenEstadoHistorial> getHistorial() {
        return Collections.unmodifiableList(historial);
    }

    private void aplicar(DatosRecepcion recepcion) {
        this.motivoIngreso = recepcion.motivoIngreso();
        this.descripcionProblema = recepcion.descripcionProblema();
        this.observaciones = recepcion.observaciones();
    }

    /** RN-28: los ítems solo se agregan, editan o quitan en diagnóstico. */
    private void exigirEditableItems() {
        if (estado != EstadoOrden.EN_DIAGNOSTICO) {
            throw new ConflictException(ErrorCode.ORDEN_ESTADO_INVALIDO,
                    "Los ítems solo se modifican en diagnóstico", Map.of("estado", estado.name()));
        }
    }

    private OrdenServicio servicio(Long itemId) {
        return servicios.stream().filter(s -> Objects.equals(s.getId(), itemId)).findFirst()
                .orElseThrow(() -> new NotFoundException("orden_servicio", itemId));
    }

    private OrdenRepuesto repuesto(Long itemId) {
        return repuestos.stream().filter(r -> Objects.equals(r.getId(), itemId)).findFirst()
                .orElseThrow(() -> new NotFoundException("orden_repuesto", itemId));
    }

    private void exigirActiva() {
        if (!esActiva()) {
            throw new ConflictException(ErrorCode.ORDEN_ESTADO_INVALIDO, "La orden está cerrada",
                    Map.of("estado", estado.name()));
        }
    }

    /** Mecánicos que entraron y salieron con una asignación. */
    public record CambioMecanicos(List<Long> agregados, List<Long> quitados) {

        public boolean hayCambios() {
            return !agregados.isEmpty() || !quitados.isEmpty();
        }
    }
}

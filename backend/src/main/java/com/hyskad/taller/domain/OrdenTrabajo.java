package com.hyskad.taller.domain;

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

import com.hyskad.clientes.domain.Cliente;
import com.hyskad.motocicletas.domain.Motocicleta;
import com.hyskad.shared.error.ConflictException;
import com.hyskad.shared.error.ErrorCode;
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

    @Version
    private long version;

    @OneToMany(mappedBy = "orden", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("asignadoEn, id.mecanicoId")
    @BatchSize(size = 50)
    private List<OrdenMecanico> mecanicos = new ArrayList<>();

    @OneToMany(mappedBy = "orden", cascade = CascadeType.ALL)
    @OrderBy("fecha, id")
    private List<OrdenEstadoHistorial> historial = new ArrayList<>();

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

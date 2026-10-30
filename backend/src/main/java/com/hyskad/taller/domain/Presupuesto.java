package com.hyskad.taller.domain;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import com.hyskad.shared.error.ConflictException;
import com.hyskad.shared.error.ErrorCode;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * Presupuesto de una orden (RF22, RN-31): copia congelada de sus ítems y totales al enviarlo,
 * numerada {@code P-000001} y con {@code version} 1, 2, 3… dentro de la orden. Solo un presupuesto
 * {@code PENDIENTE} se decide (RN-33) o se reemplaza.
 */
@Entity
@Table(name = "presupuesto")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Presupuesto {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "orden_id", nullable = false, updatable = false)
    private OrdenTrabajo orden;

    @Column(nullable = false, unique = true, updatable = false, length = 20)
    private String numero;

    @Column(nullable = false, updatable = false)
    private int version;

    @Column(nullable = false, updatable = false, precision = 15, scale = 2)
    private BigDecimal subtotal;

    @Column(nullable = false, updatable = false, precision = 15, scale = 2)
    private BigDecimal descuento;

    @Column(name = "iva_porcentaje", nullable = false, updatable = false, precision = 5, scale = 2)
    private BigDecimal ivaPorcentaje;

    @Column(nullable = false, updatable = false, precision = 15, scale = 2)
    private BigDecimal impuesto;

    @Column(nullable = false, updatable = false, precision = 15, scale = 2)
    private BigDecimal total;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(nullable = false, length = 12)
    private EstadoPresupuesto estado;

    @Column(updatable = false, length = 1000)
    private String observaciones;

    @Column(name = "fecha_envio", nullable = false, updatable = false)
    private Instant fechaEnvio;

    @Column(name = "enviado_por", updatable = false)
    private Long enviadoPor;

    @Column(name = "fecha_decision")
    private Instant fechaDecision;

    @Column(name = "decidido_por")
    private Long decididoPor;

    @Column(name = "observaciones_decision", length = 1000)
    private String observacionesDecision;

    @OneToMany(mappedBy = "presupuesto", cascade = CascadeType.ALL)
    @OrderBy("id")
    private List<PresupuestoItem> items = new ArrayList<>();

    /** Congela los ítems y los totales que tiene la orden ahora (con el descuento ya aplicado). */
    public Presupuesto(OrdenTrabajo orden, String numero, int version, String observaciones, Long enviadoPor,
            Instant fechaEnvio) {
        this.orden = orden;
        this.numero = numero;
        this.version = version;
        this.observaciones = observaciones;
        this.enviadoPor = enviadoPor;
        this.fechaEnvio = fechaEnvio;
        this.estado = EstadoPresupuesto.PENDIENTE;
        this.subtotal = orden.getSubtotal();
        this.descuento = orden.getDescuento();
        this.ivaPorcentaje = orden.getIvaPorcentaje();
        this.impuesto = orden.getImpuesto();
        this.total = orden.getTotal();
        orden.getServicios().forEach(s -> items.add(new PresupuestoItem(this, TipoItem.SERVICIO, s.getDescripcion(),
                BigDecimal.ONE, s.getPrecio())));
        orden.getRepuestos().forEach(r -> items.add(new PresupuestoItem(this, TipoItem.REPUESTO,
                r.getProducto().getCodigo() + " · " + r.getProducto().getNombre(), r.getCantidad(),
                r.getPrecioUnitario())));
    }

    public List<PresupuestoItem> getItems() {
        return Collections.unmodifiableList(items);
    }

    /** RN-33: la decisión del cliente, con quién la registró y sus observaciones. */
    public void decidir(EstadoPresupuesto decision, String observaciones, Long usuarioId, Instant ahora) {
        if (decision != EstadoPresupuesto.APROBADO && decision != EstadoPresupuesto.RECHAZADO) {
            throw new IllegalArgumentException("La decisión es APROBADO o RECHAZADO");
        }
        exigirPendiente();
        this.estado = decision;
        this.observacionesDecision = observaciones;
        this.decididoPor = usuarioId;
        this.fechaDecision = ahora;
    }

    /** RN-31: otro presupuesto lo reemplaza, se retira para ajustarlo o la orden se cancela. */
    public void reemplazar(Long usuarioId, Instant ahora) {
        exigirPendiente();
        this.estado = EstadoPresupuesto.REEMPLAZADO;
        this.decididoPor = usuarioId;
        this.fechaDecision = ahora;
    }

    public void exigirPendiente() {
        if (estado != EstadoPresupuesto.PENDIENTE) {
            throw new ConflictException(ErrorCode.PRESUPUESTO_NO_PENDIENTE, "El presupuesto ya no está pendiente",
                    Map.of("estado", estado.name()));
        }
    }

    public enum TipoItem {
        SERVICIO, REPUESTO
    }
}

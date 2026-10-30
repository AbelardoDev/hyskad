package com.hyskad.ventas.domain;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import com.hyskad.catalogo.domain.Producto;
import com.hyskad.clientes.domain.Cliente;
import com.hyskad.shared.dinero.CalculadoraTotales;
import com.hyskad.shared.dinero.CalculadoraTotales.Totales;
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
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * Venta de mostrador. Se registra completa y ya pagada (RN-20) con los precios vigentes, el
 * descuento y el IVA aplicado (RN-03, RN-04); solo cambia para anularse una vez (RN-21). Sin
 * cliente es consumidor final (RN-18).
 */
@Entity
@Table(name = "venta")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Venta extends BaseEntity {

    @Column(nullable = false, unique = true, updatable = false, length = 20)
    private String numero;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cliente_id", updatable = false)
    private Cliente cliente;

    @Column(nullable = false, updatable = false)
    private Instant fecha;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal subtotal;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal descuento;

    @Column(name = "iva_porcentaje", nullable = false, updatable = false, precision = 5, scale = 2)
    private BigDecimal ivaPorcentaje;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal impuesto;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal total;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(name = "metodo_pago", nullable = false, updatable = false, length = 15)
    private MetodoPago metodoPago;

    @Column(name = "referencia_pago", updatable = false, length = 60)
    private String referenciaPago;

    @Column(name = "monto_recibido", updatable = false, precision = 15, scale = 2)
    private BigDecimal montoRecibido;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(nullable = false, length = 10)
    private EstadoVenta estado;

    @Column(name = "motivo_anulacion", length = 500)
    private String motivoAnulacion;

    @Column(name = "anulada_por")
    private Long anuladaPor;

    @Column(name = "anulada_en")
    private Instant anuladaEn;

    @OneToMany(mappedBy = "venta", cascade = CascadeType.ALL)
    @OrderBy("id")
    private List<VentaDetalle> detalles = new ArrayList<>();

    public Venta(String numero, Cliente cliente, Instant fecha, BigDecimal ivaPorcentaje) {
        this.numero = numero;
        this.cliente = cliente;
        this.fecha = fecha;
        this.ivaPorcentaje = ivaPorcentaje;
        this.descuento = BigDecimal.ZERO;
        this.estado = EstadoVenta.PAGADA;
        recalcular();
    }

    /** Agrega un ítem al precio de venta vigente del producto (el cliente no envía precios). */
    public void agregar(Producto producto, BigDecimal cantidad) {
        detalles.add(new VentaDetalle(this, producto, cantidad));
        recalcular();
    }

    /** RN-05: de 0 al subtotal; lo valida quien llama con su error de validación. */
    public void aplicarDescuento(BigDecimal descuento) {
        this.descuento = descuento;
        recalcular();
    }

    /** RN-20: referencia (salvo efectivo) y, en efectivo, el monto recibido para dar el cambio. */
    public void pagar(MetodoPago metodo, String referencia, BigDecimal montoRecibido) {
        this.metodoPago = metodo;
        this.referenciaPago = metodo.requiereReferencia() ? referencia : null;
        this.montoRecibido = metodo == MetodoPago.EFECTIVO ? montoRecibido : null;
    }

    /** Cambio a devolver en efectivo; {@code null} si no se registró el monto recibido. */
    public BigDecimal getCambio() {
        return montoRecibido == null ? null : montoRecibido.subtract(total);
    }

    public List<VentaDetalle> getDetalles() {
        return Collections.unmodifiableList(detalles);
    }

    /** RN-21: una venta anulada no se vuelve a anular. */
    public void anular(String motivo, Long usuarioId, Instant momento) {
        if (estado == EstadoVenta.ANULADA) {
            throw new ConflictException(ErrorCode.VENTA_ANULADA, "La venta ya está anulada");
        }
        this.estado = EstadoVenta.ANULADA;
        this.motivoAnulacion = motivo;
        this.anuladaPor = usuarioId;
        this.anuladaEn = momento;
    }

    private void recalcular() {
        Totales totales = CalculadoraTotales.calcular(detalles.stream().map(VentaDetalle::getSubtotal).toList(),
                descuento, ivaPorcentaje);
        this.subtotal = totales.subtotal();
        this.impuesto = totales.impuesto();
        this.total = totales.total();
    }
}

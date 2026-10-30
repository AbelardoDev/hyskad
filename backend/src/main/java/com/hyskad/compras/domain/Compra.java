package com.hyskad.compras.domain;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import com.hyskad.catalogo.domain.Producto;
import com.hyskad.proveedores.domain.Proveedor;
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
 * Compra a un proveedor (RF21). Se registra completa con sus ítems y totales (RN-04, sin
 * descuento) y queda {@code REGISTRADA} (RN-16); solo cambia para anularse una vez (RN-17).
 */
@Entity
@Table(name = "compra")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Compra extends BaseEntity {

    @Column(nullable = false, unique = true, updatable = false, length = 20)
    private String numero;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "proveedor_id", nullable = false, updatable = false)
    private Proveedor proveedor;

    @Column(name = "numero_factura_proveedor", nullable = false, updatable = false, length = 40)
    private String numeroFacturaProveedor;

    @Column(nullable = false, updatable = false)
    private LocalDate fecha;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal subtotal;

    @Column(name = "iva_porcentaje", nullable = false, precision = 5, scale = 2)
    private BigDecimal ivaPorcentaje;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal impuesto;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal total;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(nullable = false, length = 12)
    private EstadoCompra estado;

    @Column(name = "motivo_anulacion", length = 500)
    private String motivoAnulacion;

    @Column(name = "anulada_por")
    private Long anuladaPor;

    @Column(name = "anulada_en")
    private Instant anuladaEn;

    @OneToMany(mappedBy = "compra", cascade = CascadeType.ALL)
    @OrderBy("id")
    private List<CompraDetalle> detalles = new ArrayList<>();

    public Compra(String numero, Proveedor proveedor, String numeroFacturaProveedor, LocalDate fecha,
            BigDecimal ivaPorcentaje) {
        this.numero = numero;
        this.proveedor = proveedor;
        this.numeroFacturaProveedor = numeroFacturaProveedor;
        this.fecha = fecha;
        this.ivaPorcentaje = ivaPorcentaje;
        this.estado = EstadoCompra.REGISTRADA;
        recalcular();
    }

    public void agregar(Producto producto, BigDecimal cantidad, BigDecimal costoUnitario) {
        detalles.add(new CompraDetalle(this, producto, cantidad, costoUnitario));
        recalcular();
    }

    public List<CompraDetalle> getDetalles() {
        return Collections.unmodifiableList(detalles);
    }

    /** RN-17: una compra anulada no vuelve a anularse. */
    public void anular(String motivo, Long usuarioId, Instant momento) {
        if (estado == EstadoCompra.ANULADA) {
            throw new ConflictException(ErrorCode.COMPRA_ANULADA, "La compra ya está anulada");
        }
        this.estado = EstadoCompra.ANULADA;
        this.motivoAnulacion = motivo;
        this.anuladaPor = usuarioId;
        this.anuladaEn = momento;
    }

    private void recalcular() {
        Totales totales = CalculadoraTotales.calcular(detalles.stream().map(CompraDetalle::getSubtotal).toList(),
                BigDecimal.ZERO, ivaPorcentaje);
        this.subtotal = totales.subtotal();
        this.impuesto = totales.impuesto();
        this.total = totales.total();
    }
}

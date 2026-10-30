package com.hyskad.catalogo.domain;

import java.math.BigDecimal;
import java.util.Map;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import com.hyskad.shared.error.ConflictException;
import com.hyskad.shared.error.ErrorCode;
import com.hyskad.shared.persistence.BaseEntity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * Producto o repuesto (RF17) con sus existencias (RF18). El stock nace en 0 y solo cambia con los
 * métodos de movimiento, que llama {@code InventarioService} con la fila bloqueada (RN-12). Aquí
 * viven las reglas: RN-07/08 (costo promedio), RN-10 (nunca negativo ni más reservado que
 * existente) y RN-15 (inactivo no se mueve; no se desactiva con reservas).
 */
@Entity
@Table(name = "producto")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Producto extends BaseEntity {

    @Column(nullable = false, unique = true, length = 40)
    private String codigo;

    @Column(nullable = false, length = 150)
    private String nombre;

    @Column(length = 500)
    private String descripcion;

    @Column(length = 80)
    private String marca;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "categoria_id", nullable = false)
    private Categoria categoria;

    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.VARCHAR)
    @Column(nullable = false, length = 10)
    private Unidad unidad;

    @Column(name = "precio_venta", nullable = false, precision = 15, scale = 2)
    private BigDecimal precioVenta;

    @Column(name = "costo_promedio", nullable = false, precision = 15, scale = 2)
    private BigDecimal costoPromedio;

    @Column(name = "stock_actual", nullable = false, precision = 12, scale = 2)
    private BigDecimal stockActual;

    @Column(name = "stock_reservado", nullable = false, precision = 12, scale = 2)
    private BigDecimal stockReservado;

    @Column(name = "stock_minimo", nullable = false, precision = 12, scale = 2)
    private BigDecimal stockMinimo;

    @Column(nullable = false)
    private boolean activo;

    @Version
    private long version;

    public Producto(DatosProducto datos, Categoria categoria) {
        actualizar(datos, categoria);
        this.costoPromedio = BigDecimal.ZERO;
        this.stockActual = BigDecimal.ZERO;
        this.stockReservado = BigDecimal.ZERO;
        this.activo = true;
    }

    /** Datos del catálogo; nunca toca existencias ni costo. */
    public void actualizar(DatosProducto datos, Categoria categoria) {
        this.codigo = datos.codigo();
        this.nombre = datos.nombre();
        this.descripcion = datos.descripcion();
        this.marca = datos.marca();
        this.unidad = datos.unidad();
        this.precioVenta = datos.precioVenta();
        this.stockMinimo = datos.stockMinimo();
        this.categoria = categoria;
    }

    /** RN-15: no se desactiva con unidades reservadas (por órdenes en curso). */
    public void cambiarEstado(boolean activo) {
        if (!activo && stockReservado.signum() > 0) {
            throw new ConflictException(ErrorCode.RESERVA_PENDIENTE,
                    "El producto tiene unidades reservadas", Map.of("reservado", stockReservado));
        }
        this.activo = activo;
    }

    public BigDecimal getStockDisponible() {
        return stockActual.subtract(stockReservado);
    }

    public EstadoStock getEstadoStock() {
        BigDecimal disponible = getStockDisponible();
        if (disponible.signum() <= 0) {
            return EstadoStock.AGOTADO;
        }
        return disponible.compareTo(stockMinimo) <= 0 ? EstadoStock.BAJO : EstadoStock.OK;
    }

    /** RN-14: el disponible está en el mínimo o por debajo. */
    public boolean estaBajo() {
        return getStockDisponible().compareTo(stockMinimo) <= 0;
    }

    /** Entrada con costo (compra, devolución, ajuste): recalcula el costo promedio (RN-07, RN-09). */
    public void registrarEntrada(BigDecimal cantidad, BigDecimal costoUnitario) {
        verificarActivo();
        this.costoPromedio = CostoPromedio.calcular(stockActual, costoPromedio, cantidad, costoUnitario);
        this.stockActual = stockActual.add(cantidad);
    }

    /**
     * Salida de existencias no reservadas (venta, ajuste, anulación de compra). No cambia el costo
     * (RN-08). Devuelve el costo promedio vigente, que se registra en el movimiento.
     */
    public BigDecimal registrarSalida(BigDecimal cantidad) {
        verificarActivo();
        verificarDisponible(cantidad);
        this.stockActual = stockActual.subtract(cantidad);
        return costoPromedio;
    }

    public void reservar(BigDecimal cantidad) {
        verificarActivo();
        verificarDisponible(cantidad);
        this.stockReservado = stockReservado.add(cantidad);
    }

    public void liberarReserva(BigDecimal cantidad) {
        verificarActivo();
        verificarReservado(cantidad);
        this.stockReservado = stockReservado.subtract(cantidad);
    }

    /** Sale lo que estaba reservado (repuesto usado en una orden). Devuelve el costo vigente (RN-08). */
    public BigDecimal consumirReserva(BigDecimal cantidad) {
        verificarActivo();
        verificarReservado(cantidad);
        this.stockReservado = stockReservado.subtract(cantidad);
        this.stockActual = stockActual.subtract(cantidad);
        return costoPromedio;
    }

    private void verificarActivo() {
        if (!activo) {
            throw new ConflictException(ErrorCode.PRODUCTO_INACTIVO, "El producto está inactivo",
                    Map.of("codigo", codigo));
        }
    }

    /** RN-10/RN-13: lo que sale o se reserva no puede superar el disponible. */
    private void verificarDisponible(BigDecimal cantidad) {
        if (getStockDisponible().compareTo(cantidad) < 0) {
            throw new ConflictException(ErrorCode.STOCK_INSUFICIENTE, "Stock disponible insuficiente",
                    Map.of("codigo", codigo, "disponible", getStockDisponible(), "solicitado", cantidad));
        }
    }

    private void verificarReservado(BigDecimal cantidad) {
        if (stockReservado.compareTo(cantidad) < 0) {
            throw new ConflictException(ErrorCode.RESERVA_INSUFICIENTE, "No hay tantas unidades reservadas",
                    Map.of("codigo", codigo, "reservado", stockReservado, "solicitado", cantidad));
        }
    }
}

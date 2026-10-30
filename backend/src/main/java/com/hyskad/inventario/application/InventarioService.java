package com.hyskad.inventario.application;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Map;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hyskad.catalogo.application.ProductoService;
import com.hyskad.catalogo.domain.Producto;
import com.hyskad.inventario.domain.MovimientoInventario;
import com.hyskad.inventario.domain.Referencia;
import com.hyskad.inventario.domain.StockBajoDetectado;
import com.hyskad.inventario.domain.TipoMovimiento;
import com.hyskad.inventario.persistence.MovimientoInventarioRepository;
import com.hyskad.inventario.persistence.MovimientoSpecifications;
import com.hyskad.shared.audit.AuditoriaService;
import com.hyskad.shared.error.BusinessException;
import com.hyskad.shared.error.ErrorCode;
import com.hyskad.shared.security.UsuarioActual;

/**
 * Única puerta para mover existencias (RF18). Ventas, compras y taller la usan; nadie más cambia el
 * stock de un producto.
 *
 * <p>Contrato común de los métodos que mueven stock: se ejecutan en la transacción del llamador
 * (o abren una), bloquean el producto con {@code PESSIMISTIC_WRITE} (RN-12), rechazan productos
 * inactivos con {@code PRODUCTO_INACTIVO} (RN-15; salvo la devolución de una venta anulada),
 * cantidades no positivas o con más de 2 decimales con {@code CANTIDAD_INVALIDA}, y lo que dejaría stock negativo o más reservado que existente con
 * {@code STOCK_INSUFICIENTE} / {@code RESERVA_INSUFICIENTE} (RN-10). Los que cambian existencias
 * guardan un movimiento inmutable (RN-11) y, si el disponible cruza el mínimo hacia abajo, publican
 * {@link StockBajoDetectado} una sola vez (RN-14). Las reservas no cambian existencias: no generan
 * movimiento.
 */
@Service
public class InventarioService {

    static final int MOTIVO_MINIMO = 10;
    static final int MAX_EXPORTACION = 10_000;
    private static final int DECIMALES = 2;
    private static final String ENTIDAD = "producto";

    private final ProductoService productos;
    private final MovimientoInventarioRepository movimientos;
    private final ApplicationEventPublisher eventos;
    private final AuditoriaService auditoria;
    private final UsuarioActual usuarioActual;
    private final Clock clock;

    public InventarioService(ProductoService productos, MovimientoInventarioRepository movimientos,
            ApplicationEventPublisher eventos, AuditoriaService auditoria, UsuarioActual usuarioActual, Clock clock) {
        this.productos = productos;
        this.movimientos = movimientos;
        this.eventos = eventos;
        this.auditoria = auditoria;
        this.usuarioActual = usuarioActual;
        this.clock = clock;
    }

    /**
     * Entrada por compra ({@code ENTRADA_COMPRA}): suma existencias y recalcula el costo promedio
     * ponderado con {@code costoUnitario} (RN-07).
     *
     * @return el movimiento creado
     */
    @Transactional
    public MovimientoInventario registrarEntradaCompra(Long productoId, BigDecimal cantidad, BigDecimal costoUnitario,
            Referencia referencia) {
        return entrar(productoId, TipoMovimiento.ENTRADA_COMPRA, cantidad, costoUnitario, referencia, null);
    }

    /**
     * Salida por venta de mostrador ({@code SALIDA_VENTA}) sobre el disponible (RN-19). No cambia el
     * costo promedio (RN-08).
     *
     * @return el costo unitario aplicado (promedio vigente), para congelarlo en el detalle de la venta
     */
    @Transactional
    public BigDecimal registrarSalidaVenta(Long productoId, BigDecimal cantidad, Referencia referencia) {
        return salir(productoId, TipoMovimiento.SALIDA_VENTA, cantidad, referencia, null).getCostoUnitario();
    }

    /** Aparta {@code cantidad} del disponible para una orden (RF19). No genera movimiento. */
    @Transactional
    public void reservar(Long productoId, BigDecimal cantidad, Referencia referencia) {
        validarCantidad(cantidad);
        Producto producto = productos.bloquear(productoId);
        boolean estabaBajo = producto.estaBajo();
        producto.reservar(cantidad);
        avisarSiCruzaElMinimo(producto, estabaBajo);
    }

    /** Devuelve al disponible unidades reservadas (repuesto retirado de una orden). No genera movimiento. */
    @Transactional
    public void liberarReserva(Long productoId, BigDecimal cantidad, Referencia referencia) {
        validarCantidad(cantidad);
        productos.bloquear(productoId).liberarReserva(cantidad);
    }

    /**
     * Sale lo reservado para una orden ({@code SALIDA_ORDEN}): baja existencias y reserva a la vez,
     * con un solo movimiento.
     *
     * @return el costo unitario aplicado (promedio vigente, RN-08)
     */
    @Transactional
    public BigDecimal consumirReserva(Long productoId, BigDecimal cantidad, Referencia referencia) {
        validarCantidad(cantidad);
        Producto producto = productos.bloquear(productoId);
        boolean estabaBajo = producto.estaBajo();
        BigDecimal costo = producto.consumirReserva(cantidad);
        guardar(producto, TipoMovimiento.SALIDA_ORDEN, cantidad, costo, referencia, null);
        avisarSiCruzaElMinimo(producto, estabaBajo);
        return costo;
    }

    /**
     * Devolución por anulación de venta ({@code DEVOLUCION_ANULACION_VENTA}): entra al costo
     * registrado en esa venta y recalcula el promedio (RN-09). Es la excepción a RN-15: se acepta
     * aunque el producto esté inactivo, para que anular una venta siempre devuelva todo (RN-21).
     */
    @Transactional
    public MovimientoInventario registrarDevolucionVenta(Long productoId, BigDecimal cantidad, BigDecimal costoUnitario,
            Referencia referencia) {
        validarCantidad(cantidad);
        Producto producto = productos.bloquear(productoId);
        BigDecimal costo = validarCosto(costoUnitario);
        boolean estabaBajo = producto.estaBajo();
        producto.registrarDevolucion(cantidad, costo);
        MovimientoInventario movimiento = guardar(producto, TipoMovimiento.DEVOLUCION_ANULACION_VENTA, cantidad, costo,
                referencia, null);
        avisarSiCruzaElMinimo(producto, estabaBajo);
        return movimiento;
    }

    /**
     * Salida por anulación de compra ({@code SALIDA_ANULACION_COMPRA}) al costo promedio vigente, sin
     * recalcularlo (RN-17). Requiere disponible suficiente.
     *
     * @return el costo unitario aplicado
     */
    @Transactional
    public BigDecimal registrarSalidaAnulacionCompra(Long productoId, BigDecimal cantidad, Referencia referencia) {
        return salir(productoId, TipoMovimiento.SALIDA_ANULACION_COMPRA, cantidad, referencia, null)
                .getCostoUnitario();
    }

    /**
     * Ajuste manual (RN-13): {@code ENTRADA_AJUSTE} al costo indicado (o al promedio vigente si no se
     * indica) recalculando el promedio, o {@code SALIDA_AJUSTE} al promedio vigente sin dejar el stock
     * bajo lo reservado. Se audita. El permiso {@code INVENTARIO_AJUSTAR} lo exige el controlador.
     *
     * @return el movimiento creado
     */
    @Transactional
    public MovimientoInventario ajustar(AjustarInventario datos) {
        String motivo = datos.motivo().trim();
        if (motivo.length() < MOTIVO_MINIMO) {
            throw new BusinessException(ErrorCode.VALIDACION, "El motivo es demasiado corto",
                    Map.of("minimo", MOTIVO_MINIMO));
        }
        MovimientoInventario movimiento = datos.tipo() == TipoAjuste.ENTRADA
                ? entrar(datos.productoId(), TipoMovimiento.ENTRADA_AJUSTE, datos.cantidad(), datos.costoUnitario(),
                        null, motivo)
                : salir(datos.productoId(), TipoMovimiento.SALIDA_AJUSTE, datos.cantidad(), null, motivo);
        auditoria.registrar("INVENTARIO_AJUSTADO", ENTIDAD, datos.productoId(), Map.of(
                "tipo", movimiento.getTipo().name(), "cantidad", movimiento.getCantidad(),
                "movimientoId", movimiento.getId()));
        return movimiento;
    }

    /** Movimientos filtrados, los más recientes primero salvo que se pida otro orden. */
    @Transactional(readOnly = true)
    public Page<MovimientoInventario> movimientos(FiltroMovimientos filtro, Pageable pagina) {
        return movimientos.findAll(especificacion(filtro), pagina);
    }

    /** Hasta {@value #MAX_EXPORTACION} movimientos para exportar, los más recientes primero. */
    @Transactional(readOnly = true)
    public List<MovimientoInventario> movimientosParaExportar(FiltroMovimientos filtro) {
        return movimientos.findAll(especificacion(filtro),
                PageRequest.of(0, MAX_EXPORTACION, Sort.by(Sort.Direction.DESC, "fecha", "id"))).getContent();
    }

    private MovimientoInventario entrar(Long productoId, TipoMovimiento tipo, BigDecimal cantidad,
            BigDecimal costoUnitario, Referencia referencia, String motivo) {
        validarCantidad(cantidad);
        Producto producto = productos.bloquear(productoId);
        BigDecimal costo = costoUnitario == null ? producto.getCostoPromedio() : validarCosto(costoUnitario);
        boolean estabaBajo = producto.estaBajo();
        producto.registrarEntrada(cantidad, costo);
        MovimientoInventario movimiento = guardar(producto, tipo, cantidad, costo, referencia, motivo);
        avisarSiCruzaElMinimo(producto, estabaBajo);
        return movimiento;
    }

    private MovimientoInventario salir(Long productoId, TipoMovimiento tipo, BigDecimal cantidad,
            Referencia referencia, String motivo) {
        validarCantidad(cantidad);
        Producto producto = productos.bloquear(productoId);
        boolean estabaBajo = producto.estaBajo();
        BigDecimal costo = producto.registrarSalida(cantidad);
        MovimientoInventario movimiento = guardar(producto, tipo, cantidad, costo, referencia, motivo);
        avisarSiCruzaElMinimo(producto, estabaBajo);
        return movimiento;
    }

    private MovimientoInventario guardar(Producto producto, TipoMovimiento tipo, BigDecimal cantidad, BigDecimal costo,
            Referencia referencia, String motivo) {
        return movimientos.save(new MovimientoInventario(producto, tipo, cantidad, costo, referencia, motivo,
                usuarioActual.id().orElse(null), Instant.now(clock)));
    }

    /** RN-14: solo al pasar de "no bajo" a "bajo"; mientras siga bajo no se repite. */
    private void avisarSiCruzaElMinimo(Producto producto, boolean estabaBajo) {
        if (!estabaBajo && producto.estaBajo()) {
            eventos.publishEvent(new StockBajoDetectado(producto.getId(), producto.getCodigo(), producto.getNombre(),
                    producto.getStockDisponible(), producto.getStockMinimo()));
        }
    }

    private static void validarCantidad(BigDecimal cantidad) {
        if (cantidad == null || cantidad.signum() <= 0 || cantidad.stripTrailingZeros().scale() > DECIMALES) {
            throw new BusinessException(ErrorCode.CANTIDAD_INVALIDA,
                    "La cantidad debe ser mayor que cero y tener máximo 2 decimales");
        }
    }

    private static BigDecimal validarCosto(BigDecimal costo) {
        if (costo.signum() < 0 || costo.stripTrailingZeros().scale() > DECIMALES) {
            throw new BusinessException(ErrorCode.VALIDACION, "El costo unitario no es válido");
        }
        return costo;
    }

    private static Specification<MovimientoInventario> especificacion(FiltroMovimientos f) {
        return MovimientoSpecifications.filtrar(f.productoId(), f.tipo(), f.desde(), f.hasta(), f.usuarioId());
    }
}

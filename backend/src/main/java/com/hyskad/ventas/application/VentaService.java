package com.hyskad.ventas.application;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hyskad.catalogo.application.ProductoService;
import com.hyskad.catalogo.domain.Producto;
import com.hyskad.clientes.application.ClienteService;
import com.hyskad.clientes.domain.Cliente;
import com.hyskad.configuracion.application.ConfiguracionService;
import com.hyskad.configuracion.application.DatosTaller;
import com.hyskad.inventario.application.InventarioService;
import com.hyskad.inventario.domain.Referencia;
import com.hyskad.shared.audit.AuditoriaService;
import com.hyskad.shared.config.TiempoConfig;
import com.hyskad.shared.consecutivo.ConsecutivoService;
import com.hyskad.shared.consecutivo.TipoConsecutivo;
import com.hyskad.shared.error.BusinessException;
import com.hyskad.shared.error.ErrorCampo;
import com.hyskad.shared.error.ErrorCode;
import com.hyskad.shared.error.NotFoundException;
import com.hyskad.shared.security.UsuarioActual;
import com.hyskad.ventas.domain.MetodoPago;
import com.hyskad.ventas.domain.Venta;
import com.hyskad.ventas.domain.VentaAnulada;
import com.hyskad.ventas.persistence.VentaRepository;
import com.hyskad.ventas.persistence.VentaSpecifications;

/**
 * Ventas de mostrador (RN-18 a RN-21). Registrar y anular ocurren en una sola transacción: si un
 * ítem falla no queda nada. El stock sale y vuelve solo por {@link InventarioService}.
 */
@Service
public class VentaService {

    static final String ENTIDAD = "venta";
    static final int MAX_ITEMS = 200;

    private final VentaRepository repository;
    private final ClienteService clientes;
    private final ProductoService productos;
    private final InventarioService inventario;
    private final ConfiguracionService configuracion;
    private final ConsecutivoService consecutivos;
    private final AuditoriaService auditoria;
    private final UsuarioActual usuarioActual;
    private final ApplicationEventPublisher eventos;
    private final Clock clock;

    public VentaService(VentaRepository repository, ClienteService clientes, ProductoService productos,
            InventarioService inventario, ConfiguracionService configuracion, ConsecutivoService consecutivos,
            AuditoriaService auditoria, UsuarioActual usuarioActual, ApplicationEventPublisher eventos, Clock clock) {
        this.repository = repository;
        this.clientes = clientes;
        this.productos = productos;
        this.inventario = inventario;
        this.configuracion = configuracion;
        this.consecutivos = consecutivos;
        this.auditoria = auditoria;
        this.usuarioActual = usuarioActual;
        this.eventos = eventos;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public Page<Venta> listar(FiltroVentas filtro, Pageable pagina) {
        return repository.findAll(especificacion(filtro), pagina);
    }

    /** Cantidad y total de las ventas filtradas (para los totales del periodo en la lista). */
    @Transactional(readOnly = true)
    public ResumenVentas resumir(FiltroVentas filtro) {
        var resumen = repository.resumir(especificacion(filtro));
        return new ResumenVentas(resumen.cantidad(), resumen.total());
    }

    @Transactional(readOnly = true)
    public Venta obtener(Long id) {
        return repository.findById(id).orElseThrow(() -> new NotFoundException(ENTIDAD, id));
    }

    /** Lo necesario para imprimir: la venta y los datos del taller (RF27). */
    @Transactional(readOnly = true)
    public Comprobante comprobante(Long id) {
        return new Comprobante(obtener(id), configuracion.getDatosTaller());
    }

    /**
     * RN-18 a RN-20: valida todo antes de mover stock (cliente activo, productos existentes,
     * activos y sin repetir, descuento, referencia y monto recibido), numera la venta
     * ({@code V-000001}) con los precios vigentes y el IVA vigente, y saca el stock de cada ítem
     * congelando el costo aplicado.
     */
    @Transactional
    public Venta registrar(RegistrarVenta datos) {
        List<Producto> productosItems = validarItems(datos);
        Cliente cliente = datos.clienteId() == null ? null : clientes.obtenerActivo(datos.clienteId());

        Venta venta = new Venta(consecutivos.siguiente(TipoConsecutivo.VENTA), cliente, Instant.now(clock),
                configuracion.getIvaPorcentaje());
        for (int i = 0; i < datos.items().size(); i++) {
            venta.agregar(productosItems.get(i), datos.items().get(i).cantidad());
        }
        validarPago(datos, venta);
        venta.aplicarDescuento(datos.descuento());
        venta.pagar(datos.metodoPago(), texto(datos.referenciaPago()), datos.montoRecibido());
        validarMontoRecibido(datos, venta);
        repository.save(venta);

        Referencia referencia = referencia(venta);
        // En orden de producto para que dos ventas simultáneas bloqueen las filas en el mismo orden
        venta.getDetalles().stream().sorted(Comparator.comparing(d -> d.getProducto().getId()))
                .forEach(d -> d.congelarCosto(inventario.registrarSalidaVenta(d.getProducto().getId(),
                        d.getCantidad(), referencia)));
        auditoria.registrar("VENTA_REGISTRADA", ENTIDAD, venta.getId(), Map.of(
                "numero", venta.getNumero(), "items", venta.getDetalles().size(), "total", venta.getTotal(),
                "metodoPago", venta.getMetodoPago().name()));
        return venta;
    }

    /**
     * RN-21: devuelve al inventario cada ítem al costo congelado en la venta (RN-09) y la deja
     * {@code ANULADA}; publica {@link VentaAnulada}. Una venta anulada no se vuelve a anular.
     */
    @Transactional
    public Venta anular(Long id, AnularVenta datos) {
        Venta venta = repository.bloquear(id).orElseThrow(() -> new NotFoundException(ENTIDAD, id));
        Long usuarioId = usuarioActual.id().orElse(null);
        venta.anular(datos.motivo().trim(), usuarioId, Instant.now(clock));
        Referencia referencia = referencia(venta);
        venta.getDetalles().stream().sorted(Comparator.comparing(d -> d.getProducto().getId()))
                .forEach(d -> inventario.registrarDevolucionVenta(d.getProducto().getId(), d.getCantidad(),
                        d.getCostoUnitario(), referencia));
        auditoria.registrar("VENTA_ANULADA", ENTIDAD, id, Map.of("numero", venta.getNumero()));
        eventos.publishEvent(new VentaAnulada(id, venta.getNumero(), venta.getTotal(), usuarioId));
        return venta;
    }

    /** Errores por ítem (repetido, inexistente o inactivo) juntos, para marcarlos en el carrito. */
    private List<Producto> validarItems(RegistrarVenta datos) {
        List<ErrorCampo> errores = new ArrayList<>();
        List<Producto> encontrados = new ArrayList<>();
        Set<Long> vistos = new HashSet<>();
        for (int i = 0; i < datos.items().size(); i++) {
            String campo = "items[" + i + "].productoId";
            Long productoId = datos.items().get(i).productoId();
            Producto producto = null;
            if (!vistos.add(productoId)) {
                errores.add(new ErrorCampo(campo, "PRODUCTO_REPETIDO"));
            } else {
                try {
                    producto = productos.obtener(productoId);
                    if (!producto.isActivo()) {
                        errores.add(new ErrorCampo(campo, ErrorCode.PRODUCTO_INACTIVO.name()));
                    }
                } catch (NotFoundException e) {
                    errores.add(new ErrorCampo(campo, ErrorCode.RECURSO_NO_ENCONTRADO.name()));
                }
            }
            encontrados.add(producto);
        }
        if (!errores.isEmpty()) {
            throw BusinessException.validacion(errores);
        }
        return encontrados;
    }

    /** RN-05 (descuento hasta el subtotal) y RN-20 (referencia salvo en efectivo). */
    private static void validarPago(RegistrarVenta datos, Venta venta) {
        List<ErrorCampo> errores = new ArrayList<>();
        if (datos.descuento().compareTo(venta.getSubtotal()) > 0) {
            errores.add(new ErrorCampo("descuento", "DESCUENTO_INVALIDO"));
        }
        if (datos.metodoPago().requiereReferencia() && texto(datos.referenciaPago()) == null) {
            errores.add(new ErrorCampo("referenciaPago", "REFERENCIA_REQUERIDA"));
        }
        if (!errores.isEmpty()) {
            throw BusinessException.validacion(errores);
        }
    }

    /** En efectivo, lo recibido debe cubrir el total (no hay pagos parciales, RN-20). */
    private static void validarMontoRecibido(RegistrarVenta datos, Venta venta) {
        BigDecimal recibido = venta.getMontoRecibido();
        if (datos.metodoPago() == MetodoPago.EFECTIVO && recibido != null && recibido.compareTo(venta.getTotal()) < 0) {
            throw BusinessException.validacion(List.of(new ErrorCampo("montoRecibido", "MONTO_INSUFICIENTE")));
        }
    }

    private static Specification<Venta> especificacion(FiltroVentas f) {
        return VentaSpecifications.filtrar(
                f.desde() == null ? null : f.desde().atStartOfDay(TiempoConfig.ZONA_NEGOCIO).toInstant(),
                f.hasta() == null ? null : f.hasta().plusDays(1).atStartOfDay(TiempoConfig.ZONA_NEGOCIO).toInstant(),
                f.clienteId(), f.vendedorId(), f.metodo(), f.estado(), f.numero());
    }

    private static Referencia referencia(Venta venta) {
        return new Referencia(Referencia.TipoReferencia.VENTA, venta.getId(), venta.getNumero());
    }

    private static String texto(String valor) {
        return valor == null || valor.isBlank() ? null : valor.trim();
    }

    /** La venta con los datos del taller para el comprobante. */
    public record Comprobante(Venta venta, DatosTaller taller) {
    }

    /** Cuántas ventas y por cuánto, con los mismos filtros del listado. */
    public record ResumenVentas(long cantidad, BigDecimal total) {
    }
}

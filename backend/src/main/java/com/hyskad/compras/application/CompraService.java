package com.hyskad.compras.application;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hyskad.catalogo.application.ProductoService;
import com.hyskad.catalogo.domain.Producto;
import com.hyskad.compras.domain.Compra;
import com.hyskad.compras.domain.EstadoCompra;
import com.hyskad.compras.persistence.CompraRepository;
import com.hyskad.compras.persistence.CompraSpecifications;
import com.hyskad.configuracion.application.ConfiguracionService;
import com.hyskad.inventario.application.InventarioService;
import com.hyskad.inventario.domain.Referencia;
import com.hyskad.proveedores.application.ProveedorService;
import com.hyskad.proveedores.domain.Proveedor;
import com.hyskad.shared.audit.AuditoriaService;
import com.hyskad.shared.config.TiempoConfig;
import com.hyskad.shared.consecutivo.ConsecutivoService;
import com.hyskad.shared.consecutivo.TipoConsecutivo;
import com.hyskad.shared.error.BusinessException;
import com.hyskad.shared.error.ConflictException;
import com.hyskad.shared.error.ErrorCampo;
import com.hyskad.shared.error.ErrorCode;
import com.hyskad.shared.error.NotFoundException;
import com.hyskad.shared.security.UsuarioActual;

/**
 * Compras a proveedores (RF21). Registrar y anular ocurren en una sola transacción: si un ítem
 * falla no queda nada (ni compra ni movimientos). El stock entra y sale solo por
 * {@link InventarioService} (RN-07, RN-17).
 */
@Service
public class CompraService {

    static final String ENTIDAD = "compra";
    static final int MAX_ITEMS = 200;

    private final CompraRepository repository;
    private final ProveedorService proveedores;
    private final ProductoService productos;
    private final InventarioService inventario;
    private final ConfiguracionService configuracion;
    private final ConsecutivoService consecutivos;
    private final AuditoriaService auditoria;
    private final UsuarioActual usuarioActual;
    private final Clock clock;

    public CompraService(CompraRepository repository, ProveedorService proveedores, ProductoService productos,
            InventarioService inventario, ConfiguracionService configuracion, ConsecutivoService consecutivos,
            AuditoriaService auditoria, UsuarioActual usuarioActual, Clock clock) {
        this.repository = repository;
        this.proveedores = proveedores;
        this.productos = productos;
        this.inventario = inventario;
        this.configuracion = configuracion;
        this.consecutivos = consecutivos;
        this.auditoria = auditoria;
        this.usuarioActual = usuarioActual;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public Page<Compra> listar(FiltroCompras filtro, Pageable pagina) {
        return repository.findAll(CompraSpecifications.filtrar(filtro.proveedorId(), filtro.desde(), filtro.hasta(),
                filtro.estado(), filtro.numero()), pagina);
    }

    @Transactional(readOnly = true)
    public Compra obtener(Long id) {
        return repository.findById(id).orElseThrow(() -> new NotFoundException(ENTIDAD, id));
    }

    /**
     * RN-16: valida todo antes de mover stock (proveedor activo, fecha no futura, factura no
     * repetida, productos existentes, activos y sin repetir), numera la compra ({@code C-000001}),
     * calcula los totales con el IVA vigente (RN-03, RN-04) y registra una entrada por ítem.
     */
    @Transactional
    public Compra registrar(RegistrarCompra datos) {
        List<Producto> productosItems = validarItems(datos);
        Proveedor proveedor = proveedores.obtenerActivo(datos.proveedorId());
        String factura = datos.numeroFacturaProveedor().trim();
        if (repository.existsByProveedorIdAndNumeroFacturaProveedorAndEstado(proveedor.getId(), factura,
                EstadoCompra.REGISTRADA)) {
            throw new ConflictException(ErrorCode.FACTURA_DUPLICADA,
                    "Ya hay una compra registrada con esa factura del proveedor", Map.of("factura", factura));
        }

        Compra compra = new Compra(consecutivos.siguiente(TipoConsecutivo.COMPRA), proveedor, factura, datos.fecha(),
                configuracion.getIvaPorcentaje());
        for (int i = 0; i < datos.items().size(); i++) {
            RegistrarCompra.Item item = datos.items().get(i);
            compra.agregar(productosItems.get(i), item.cantidad(), item.costoUnitario());
        }
        repository.save(compra);

        Referencia referencia = referencia(compra);
        // En orden de producto para que dos compras simultáneas bloqueen las filas en el mismo orden
        compra.getDetalles().stream().sorted(Comparator.comparing(d -> d.getProducto().getId()))
                .forEach(d -> inventario.registrarEntradaCompra(d.getProducto().getId(), d.getCantidad(),
                        d.getCostoUnitario(), referencia));
        auditoria.registrar("COMPRA_REGISTRADA", ENTIDAD, compra.getId(), Map.of(
                "numero", compra.getNumero(), "proveedorId", proveedor.getId(), "items", compra.getDetalles().size(),
                "total", compra.getTotal()));
        return compra;
    }

    /**
     * RN-17: saca del inventario lo que entró (al costo promedio vigente, sin recalcularlo) y deja la
     * compra {@code ANULADA}. Si algún producto no tiene disponible suficiente, no se anula nada.
     */
    @Transactional
    public Compra anular(Long id, AnularCompra datos) {
        Compra compra = repository.bloquear(id).orElseThrow(() -> new NotFoundException(ENTIDAD, id));
        compra.anular(datos.motivo().trim(), usuarioActual.id().orElse(null), Instant.now(clock));
        Referencia referencia = referencia(compra);
        compra.getDetalles().stream().sorted(Comparator.comparing(d -> d.getProducto().getId()))
                .forEach(d -> inventario.registrarSalidaAnulacionCompra(d.getProducto().getId(), d.getCantidad(),
                        referencia));
        auditoria.registrar("COMPRA_ANULADA", ENTIDAD, id, Map.of("numero", compra.getNumero()));
        return compra;
    }

    /** Todos los errores de los ítems y de la fecha juntos, para marcarlos en el formulario. */
    private List<Producto> validarItems(RegistrarCompra datos) {
        List<ErrorCampo> errores = new ArrayList<>();
        LocalDate hoy = LocalDate.now(clock.withZone(TiempoConfig.ZONA_NEGOCIO));
        if (datos.fecha().isAfter(hoy)) {
            errores.add(new ErrorCampo("fecha", "FECHA_FUTURA"));
        }
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

    private static Referencia referencia(Compra compra) {
        return new Referencia(Referencia.TipoReferencia.COMPRA, compra.getId(), compra.getNumero());
    }
}

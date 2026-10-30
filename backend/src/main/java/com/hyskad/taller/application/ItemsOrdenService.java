package com.hyskad.taller.application;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hyskad.catalogo.application.ProductoService;
import com.hyskad.catalogo.domain.Producto;
import com.hyskad.configuracion.application.ConfiguracionService;
import com.hyskad.inventario.application.InventarioService;
import com.hyskad.inventario.domain.Referencia;
import com.hyskad.servicios.application.ServicioService;
import com.hyskad.servicios.domain.Servicio;
import com.hyskad.shared.audit.AuditoriaService;
import com.hyskad.shared.error.BusinessException;
import com.hyskad.shared.error.ConflictException;
import com.hyskad.shared.error.ErrorCampo;
import com.hyskad.shared.error.ErrorCode;
import com.hyskad.shared.security.UsuarioActual;
import com.hyskad.taller.domain.DatosServicioOrden;
import com.hyskad.taller.domain.OrdenRepuesto;
import com.hyskad.taller.domain.OrdenServicio;
import com.hyskad.taller.domain.OrdenTrabajo;

/**
 * Servicios y repuestos de la orden (RF15, RF19, RN-28 a RN-30). Solo en {@code EN_DIAGNOSTICO},
 * con la {@code version} que leyó el cliente y, para el mecánico, en sus órdenes (RN-27). Los
 * repuestos reservan stock por {@link InventarioService} en la misma transacción; cada cambio
 * recalcula los totales con el IVA vigente (RF24).
 */
@Service
public class ItemsOrdenService {

    private final OrdenTrabajoService ordenes;
    private final ServicioService servicios;
    private final ProductoService productos;
    private final InventarioService inventario;
    private final ConfiguracionService configuracion;
    private final AuditoriaService auditoria;
    private final UsuarioActual usuarioActual;
    private final Clock clock;

    public ItemsOrdenService(OrdenTrabajoService ordenes, ServicioService servicios, ProductoService productos,
            InventarioService inventario, ConfiguracionService configuracion, AuditoriaService auditoria,
            UsuarioActual usuarioActual, Clock clock) {
        this.ordenes = ordenes;
        this.servicios = servicios;
        this.productos = productos;
        this.inventario = inventario;
        this.configuracion = configuracion;
        this.auditoria = auditoria;
        this.usuarioActual = usuarioActual;
        this.clock = clock;
    }

    @Transactional
    public void agregarServicio(Long ordenId, GuardarServicioOrden datos) {
        OrdenTrabajo orden = ordenes.paraModificar(ordenId, datos.version());
        Servicio servicio = null;
        if (datos.servicioId() != null) {
            servicio = servicios.obtener(datos.servicioId());
            if (!servicio.isActivo()) {
                throw new ConflictException(ErrorCode.SERVICIO_INACTIVO, "El servicio está inactivo",
                        Map.of("servicioId", servicio.getId()));
            }
        }
        DatosServicioOrden normalizados = validarServicio(orden, datos, servicio);
        OrdenServicio item = orden.agregarServicio(servicio, normalizados, usuarioActual.id().orElse(null),
                Instant.now(clock));
        orden.recalcular(configuracion.getIvaPorcentaje());
        auditar(orden, "ORDEN_SERVICIO_AGREGADO", Map.of("descripcion", item.getDescripcion(),
                "precio", item.getPrecio()));
    }

    @Transactional
    public void actualizarServicio(Long ordenId, Long itemId, GuardarServicioOrden datos) {
        OrdenTrabajo orden = ordenes.paraModificar(ordenId, datos.version());
        OrdenServicio actual = orden.getServicios().stream().filter(s -> s.getId().equals(itemId)).findFirst()
                .orElse(null);
        DatosServicioOrden normalizados = validarServicio(orden, datos, actual == null ? null : actual.getServicio());
        OrdenServicio item = orden.actualizarServicio(itemId, normalizados);
        orden.recalcular(configuracion.getIvaPorcentaje());
        auditar(orden, "ORDEN_SERVICIO_ACTUALIZADO", Map.of("itemId", item.getId(), "precio", item.getPrecio()));
    }

    @Transactional
    public void quitarServicio(Long ordenId, Long itemId, long version) {
        OrdenTrabajo orden = ordenes.paraModificar(ordenId, version);
        OrdenServicio item = orden.quitarServicio(itemId);
        orden.recalcular(configuracion.getIvaPorcentaje());
        auditar(orden, "ORDEN_SERVICIO_QUITADO", Map.of("descripcion", item.getDescripcion()));
    }

    /** RN-29: reserva la cantidad; si el producto ya está en la orden, se suma al mismo ítem. */
    @Transactional
    public void agregarRepuesto(Long ordenId, GuardarRepuestoOrden datos) {
        OrdenTrabajo orden = ordenes.paraModificar(ordenId, datos.version());
        if (datos.productoId() == null) {
            throw BusinessException.validacion(List.of(new ErrorCampo("productoId", "NOT_NULL")));
        }
        Producto producto = productos.obtener(datos.productoId());
        OrdenRepuesto item = orden.agregarRepuesto(producto, datos.cantidad(), usuarioActual.id().orElse(null),
                Instant.now(clock));
        inventario.reservar(producto.getId(), datos.cantidad(), referencia(orden));
        orden.recalcular(configuracion.getIvaPorcentaje());
        auditar(orden, "ORDEN_REPUESTO_AGREGADO", Map.of("productoId", producto.getId(),
                "cantidad", datos.cantidad(), "cantidadTotal", item.getCantidad()));
    }

    /** Ajusta la reserva por la diferencia: reserva más si sube, libera si baja. */
    @Transactional
    public void cambiarCantidadRepuesto(Long ordenId, Long itemId, GuardarRepuestoOrden datos) {
        OrdenTrabajo orden = ordenes.paraModificar(ordenId, datos.version());
        BigDecimal diferencia = orden.cambiarCantidadRepuesto(itemId, datos.cantidad());
        Long productoId = orden.getRepuestos().stream().filter(r -> r.getId().equals(itemId)).findFirst()
                .orElseThrow().getProducto().getId();
        if (diferencia.signum() > 0) {
            inventario.reservar(productoId, diferencia, referencia(orden));
        } else if (diferencia.signum() < 0) {
            inventario.liberarReserva(productoId, diferencia.negate(), referencia(orden));
        }
        orden.recalcular(configuracion.getIvaPorcentaje());
        auditar(orden, "ORDEN_REPUESTO_ACTUALIZADO", Map.of("productoId", productoId,
                "cantidad", datos.cantidad()));
    }

    @Transactional
    public void quitarRepuesto(Long ordenId, Long itemId, long version) {
        OrdenTrabajo orden = ordenes.paraModificar(ordenId, version);
        OrdenRepuesto item = orden.quitarRepuesto(itemId);
        inventario.liberarReserva(item.getProducto().getId(), item.getCantidad(), referencia(orden));
        orden.recalcular(configuracion.getIvaPorcentaje());
        auditar(orden, "ORDEN_REPUESTO_QUITADO", Map.of("productoId", item.getProducto().getId(),
                "cantidad", item.getCantidad()));
    }

    /**
     * RN-30: del catálogo, la descripción y el precio vacíos toman los suyos; la mano de obra libre
     * los exige. El mecánico del servicio debe estar asignado a la orden.
     */
    private static DatosServicioOrden validarServicio(OrdenTrabajo orden, GuardarServicioOrden datos,
            Servicio servicio) {
        String descripcion = texto(datos.descripcion());
        BigDecimal precio = datos.precio();
        Integer tiempo = datos.tiempoMin();
        if (servicio != null) {
            descripcion = descripcion == null ? servicio.getNombre() : descripcion;
            precio = precio == null ? servicio.getPrecioBase() : precio;
            tiempo = tiempo == null ? Integer.valueOf(servicio.getTiempoEstimadoMin()) : tiempo;
        }
        List<ErrorCampo> errores = new ArrayList<>();
        if (descripcion == null) {
            errores.add(new ErrorCampo("descripcion", "NOT_BLANK"));
        }
        if (precio == null) {
            errores.add(new ErrorCampo("precio", "NOT_NULL"));
        }
        if (datos.mecanicoId() != null && !orden.estaAsignado(datos.mecanicoId())) {
            errores.add(new ErrorCampo("mecanicoId", "MECANICO_INVALIDO"));
        }
        if (!errores.isEmpty()) {
            throw BusinessException.validacion(errores);
        }
        return new DatosServicioOrden(descripcion, precio, tiempo, datos.mecanicoId());
    }

    private void auditar(OrdenTrabajo orden, String accion, Map<String, Object> detalle) {
        auditoria.registrar(accion, OrdenTrabajoService.ENTIDAD, orden.getId(), detalle);
    }

    private static Referencia referencia(OrdenTrabajo orden) {
        return OrdenTrabajoService.referencia(orden);
    }

    private static String texto(String valor) {
        return valor == null || valor.isBlank() ? null : valor.trim();
    }
}

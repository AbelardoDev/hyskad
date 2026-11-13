package com.hyskad.busqueda.application;

import java.util.List;
import java.util.function.Supplier;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hyskad.catalogo.application.ProductoService;
import com.hyskad.clientes.application.ClienteService;
import com.hyskad.motocicletas.application.MotocicletaService;
import com.hyskad.shared.security.UsuarioActual;
import com.hyskad.taller.application.FiltroOrdenes;
import com.hyskad.taller.application.OrdenTrabajoService;
import com.hyskad.usuarios.domain.Permiso;
import com.hyskad.ventas.application.FiltroVentas;
import com.hyskad.ventas.application.VentaService;

/**
 * Búsqueda global (RF29, paleta de comandos): hasta 5 resultados por tipo, con los mismos filtros y
 * la misma visibilidad que cada listado (el mecánico solo encuentra sus órdenes, RN-27). Un tipo sin
 * su permiso de ver no se busca. Con menos de 2 caracteres no se busca nada.
 */
@Service
public class BusquedaService {

    public static final int MINIMO = 2;
    static final int POR_TIPO = 5;

    private final ClienteService clientes;
    private final MotocicletaService motocicletas;
    private final OrdenTrabajoService ordenes;
    private final ProductoService productos;
    private final VentaService ventas;
    private final UsuarioActual usuarioActual;

    public BusquedaService(ClienteService clientes, MotocicletaService motocicletas, OrdenTrabajoService ordenes,
            ProductoService productos, VentaService ventas, UsuarioActual usuarioActual) {
        this.clientes = clientes;
        this.motocicletas = motocicletas;
        this.ordenes = ordenes;
        this.productos = productos;
        this.ventas = ventas;
        this.usuarioActual = usuarioActual;
    }

    @Transactional(readOnly = true)
    public ResultadoBusqueda buscar(String consulta) {
        String q = consulta == null ? "" : consulta.trim();
        if (q.length() < MINIMO) {
            return ResultadoBusqueda.VACIO;
        }
        return new ResultadoBusqueda(
                si(Permiso.CLIENTES_VER, () -> clientes.listar(q, null, pagina("nombreCompleto")).stream()
                        .map(c -> new ResultadoBusqueda.Item(c.getId(), c.getNombreCompleto(),
                                c.getTipoDocumento() + " " + c.getNumeroDocumento() + " · " + c.getTelefono()))
                        .toList()),
                si(Permiso.MOTOS_VER, () -> motocicletas.listar(q, null, null, null, null, pagina("placa")).stream()
                        .map(m -> new ResultadoBusqueda.Item(m.getId(), m.getPlaca(),
                                m.getMarca() + " " + m.getModelo() + " · " + m.getCliente().getNombreCompleto()))
                        .toList()),
                siAlguno(List.of(Permiso.ORDENES_VER_TODAS, Permiso.ORDENES_VER_ASIGNADAS),
                        () -> ordenes.listar(new FiltroOrdenes(q, null, null, null, null),
                                PageRequest.of(0, POR_TIPO, Sort.by(Sort.Direction.DESC, "fechaIngreso"))).stream()
                                .map(o -> new ResultadoBusqueda.Item(o.getId(), o.getNumero(),
                                        o.getMotocicleta().getPlaca() + " · " + o.getCliente().getNombreCompleto()
                                                + " · " + o.getEstado().name()))
                                .toList()),
                si(Permiso.PRODUCTOS_VER, () -> productos.listar(q, null, null, null, false, pagina("nombre")).stream()
                        .map(p -> new ResultadoBusqueda.Item(p.getId(), p.getNombre(),
                                p.getCodigo() + " · " + p.getStockDisponible().stripTrailingZeros().toPlainString()))
                        .toList()),
                si(Permiso.VENTAS_VER, () -> ventas.listar(new FiltroVentas(null, null, null, null, null, null, q),
                        PageRequest.of(0, POR_TIPO, Sort.by(Sort.Direction.DESC, "fecha"))).stream()
                        .map(v -> new ResultadoBusqueda.Item(v.getId(), v.getNumero(),
                                (v.getCliente() == null ? "" : v.getCliente().getNombreCompleto() + " · ")
                                        + v.getEstado().name()))
                        .toList()));
    }

    private List<ResultadoBusqueda.Item> si(Permiso permiso, Supplier<List<ResultadoBusqueda.Item>> busqueda) {
        return siAlguno(List.of(permiso), busqueda);
    }

    private List<ResultadoBusqueda.Item> siAlguno(List<Permiso> permisos,
            Supplier<List<ResultadoBusqueda.Item>> busqueda) {
        return permisos.stream().anyMatch(p -> usuarioActual.tienePermiso(p.name())) ? busqueda.get() : List.of();
    }

    private static Pageable pagina(String orden) {
        return PageRequest.of(0, POR_TIPO, Sort.by(orden));
    }
}

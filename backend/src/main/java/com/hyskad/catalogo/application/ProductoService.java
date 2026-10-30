package com.hyskad.catalogo.application;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.hyskad.catalogo.domain.Categoria;
import com.hyskad.catalogo.domain.DatosProducto;
import com.hyskad.catalogo.domain.Producto;
import com.hyskad.catalogo.persistence.ProductoRepository;
import com.hyskad.catalogo.persistence.ProductoSpecifications;
import com.hyskad.shared.audit.AuditoriaService;
import com.hyskad.shared.error.ConflictException;
import com.hyskad.shared.error.ErrorCode;
import com.hyskad.shared.error.NotFoundException;

/**
 * Catálogo de productos (RF17, RF29). Código único en mayúsculas, categoría activa al asignarla y
 * auditoría del CRUD. Las existencias no se editan aquí: las mueve {@code InventarioService}, que
 * obtiene la fila bloqueada con {@link #bloquear(Long)}.
 */
@Service
public class ProductoService {

    static final String ENTIDAD = "producto";

    private final ProductoRepository repository;
    private final CategoriaService categorias;
    private final AuditoriaService auditoria;

    public ProductoService(ProductoRepository repository, CategoriaService categorias, AuditoriaService auditoria) {
        this.repository = repository;
        this.categorias = categorias;
        this.auditoria = auditoria;
    }

    @Transactional(readOnly = true)
    public Page<Producto> listar(String texto, Long categoriaId, String marca, Boolean activo, boolean soloStockBajo,
            Pageable pagina) {
        return repository.findAll(ProductoSpecifications.filtrar(texto, categoriaId, marca, activo, soloStockBajo),
                pagina);
    }

    /** RN-14: productos activos con el disponible en el mínimo o por debajo, los más críticos primero. */
    @Transactional(readOnly = true)
    public List<Producto> conStockBajo() {
        return repository.findAll(ProductoSpecifications.conStockBajo()).stream()
                .sorted((a, b) -> a.getStockDisponible().subtract(a.getStockMinimo())
                        .compareTo(b.getStockDisponible().subtract(b.getStockMinimo())))
                .toList();
    }

    @Transactional(readOnly = true)
    public Producto obtener(Long id) {
        return repository.findById(id).orElseThrow(() -> new NotFoundException(ENTIDAD, id));
    }

    /**
     * RN-12: el producto con su fila bloqueada ({@code PESSIMISTIC_WRITE}) hasta que termine la
     * transacción del llamador, que debe existir.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public Producto bloquear(Long id) {
        return repository.bloquear(id).orElseThrow(() -> new NotFoundException(ENTIDAD, id));
    }

    @Transactional
    public Producto crear(GuardarProducto datos) {
        DatosProducto normalizados = normalizar(datos);
        if (repository.existsByCodigo(normalizados.codigo())) {
            throw codigoDuplicado();
        }
        Categoria categoria = categorias.obtenerActiva(datos.categoriaId());
        Producto producto = repository.save(new Producto(normalizados, categoria));
        auditoria.registrar("PRODUCTO_CREADO", ENTIDAD, producto.getId(), Map.of("codigo", producto.getCodigo()));
        return producto;
    }

    @Transactional
    public Producto actualizar(Long id, GuardarProducto datos) {
        Producto producto = obtener(id);
        DatosProducto nuevos = normalizar(datos);
        if (repository.existsByCodigoAndIdNot(nuevos.codigo(), id)) {
            throw codigoDuplicado();
        }
        // Una categoría ya inactiva se conserva, pero no se puede elegir una inactiva nueva
        Categoria categoria = producto.getCategoria().getId().equals(datos.categoriaId()) ? producto.getCategoria()
                : categorias.obtenerActiva(datos.categoriaId());
        List<String> campos = camposCambiados(producto, nuevos, categoria);
        producto.actualizar(nuevos, categoria);
        if (!campos.isEmpty()) {
            auditoria.registrar("PRODUCTO_ACTUALIZADO", ENTIDAD, id, Map.of("campos", campos));
        }
        return producto;
    }

    @Transactional
    public Producto cambiarEstado(Long id, boolean activo) {
        Producto producto = obtener(id);
        if (producto.isActivo() != activo) {
            producto.cambiarEstado(activo);
            auditoria.registrar(activo ? "PRODUCTO_ACTIVADO" : "PRODUCTO_DESACTIVADO", ENTIDAD, id, Map.of());
        }
        return producto;
    }

    private static DatosProducto normalizar(GuardarProducto datos) {
        return new DatosProducto(datos.codigo().trim().toUpperCase(Locale.ROOT), datos.nombre().trim(),
                texto(datos.descripcion()), texto(datos.marca()), datos.unidad(), datos.precioVenta(),
                datos.stockMinimo());
    }

    private static List<String> camposCambiados(Producto actual, DatosProducto nuevos, Categoria categoria) {
        List<String> campos = new ArrayList<>();
        agregarSiCambia(campos, "codigo", actual.getCodigo(), nuevos.codigo());
        agregarSiCambia(campos, "nombre", actual.getNombre(), nuevos.nombre());
        agregarSiCambia(campos, "descripcion", actual.getDescripcion(), nuevos.descripcion());
        agregarSiCambia(campos, "marca", actual.getMarca(), nuevos.marca());
        agregarSiCambia(campos, "categoria", actual.getCategoria().getId(), categoria.getId());
        agregarSiCambia(campos, "unidad", actual.getUnidad(), nuevos.unidad());
        if (actual.getPrecioVenta().compareTo(nuevos.precioVenta()) != 0) {
            campos.add("precioVenta");
        }
        if (actual.getStockMinimo().compareTo(nuevos.stockMinimo()) != 0) {
            campos.add("stockMinimo");
        }
        return campos;
    }

    private static void agregarSiCambia(List<String> campos, String campo, Object antes, Object despues) {
        if (!Objects.equals(antes, despues)) {
            campos.add(campo);
        }
    }

    private static String texto(String valor) {
        return valor == null || valor.isBlank() ? null : valor.trim();
    }

    private static ConflictException codigoDuplicado() {
        return new ConflictException(ErrorCode.CODIGO_DUPLICADO, "Ya existe un producto con ese código");
    }
}

package com.hyskad.catalogo.application;

import java.util.List;
import java.util.Map;

import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hyskad.catalogo.domain.Categoria;
import com.hyskad.catalogo.persistence.CategoriaRepository;
import com.hyskad.shared.audit.AuditoriaService;
import com.hyskad.shared.error.ConflictException;
import com.hyskad.shared.error.ErrorCode;
import com.hyskad.shared.error.NotFoundException;

/** Categorías de productos (RF17): nombre único, baja lógica y auditoría. */
@Service
public class CategoriaService {

    static final String ENTIDAD = "categoria";
    private static final Sort POR_NOMBRE = Sort.by("nombre");

    private final CategoriaRepository repository;
    private final AuditoriaService auditoria;

    public CategoriaService(CategoriaRepository repository, AuditoriaService auditoria) {
        this.repository = repository;
        this.auditoria = auditoria;
    }

    /** Todas o solo las de un estado, por nombre. */
    @Transactional(readOnly = true)
    public List<Categoria> listar(Boolean activo) {
        return activo == null ? repository.findAll(POR_NOMBRE) : repository.findByActivo(activo, POR_NOMBRE);
    }

    @Transactional(readOnly = true)
    public Categoria obtener(Long id) {
        return repository.findById(id).orElseThrow(() -> new NotFoundException(ENTIDAD, id));
    }

    /** Categoría a la que se puede asignar un producto: debe estar activa. */
    @Transactional(readOnly = true)
    public Categoria obtenerActiva(Long id) {
        Categoria categoria = obtener(id);
        if (!categoria.isActivo()) {
            throw new ConflictException(ErrorCode.CATEGORIA_INACTIVA, "La categoría está inactiva",
                    Map.of("categoriaId", id));
        }
        return categoria;
    }

    @Transactional
    public Categoria crear(GuardarCategoria datos) {
        String nombre = datos.nombre().trim();
        if (repository.existsByNombre(nombre)) {
            throw duplicada();
        }
        Categoria categoria = repository.save(new Categoria(nombre, texto(datos.descripcion())));
        auditoria.registrar("CATEGORIA_CREADA", ENTIDAD, categoria.getId(), Map.of("nombre", nombre));
        return categoria;
    }

    @Transactional
    public Categoria actualizar(Long id, GuardarCategoria datos) {
        Categoria categoria = obtener(id);
        String nombre = datos.nombre().trim();
        if (repository.existsByNombreAndIdNot(nombre, id)) {
            throw duplicada();
        }
        categoria.actualizar(nombre, texto(datos.descripcion()));
        auditoria.registrar("CATEGORIA_ACTUALIZADA", ENTIDAD, id, Map.of("nombre", nombre));
        return categoria;
    }

    /** Los productos de una categoría inactiva la conservan; solo no se elige para productos nuevos. */
    @Transactional
    public Categoria cambiarEstado(Long id, boolean activo) {
        Categoria categoria = obtener(id);
        if (categoria.isActivo() != activo) {
            categoria.cambiarEstado(activo);
            auditoria.registrar(activo ? "CATEGORIA_ACTIVADA" : "CATEGORIA_DESACTIVADA", ENTIDAD, id, Map.of());
        }
        return categoria;
    }

    private static String texto(String valor) {
        return valor == null || valor.isBlank() ? null : valor.trim();
    }

    private static ConflictException duplicada() {
        return new ConflictException(ErrorCode.CATEGORIA_DUPLICADA, "Ya existe una categoría con ese nombre");
    }
}

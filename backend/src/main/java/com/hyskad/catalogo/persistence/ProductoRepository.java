package com.hyskad.catalogo.persistence;

import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import com.hyskad.catalogo.domain.Producto;

import jakarta.persistence.LockModeType;

public interface ProductoRepository extends JpaRepository<Producto, Long>, JpaSpecificationExecutor<Producto> {

    // Las respuestas llevan la categoría: se trae en la misma consulta (open-in-view apagado).

    @Override
    @EntityGraph(attributePaths = "categoria")
    Page<Producto> findAll(Specification<Producto> filtro, Pageable pagina);

    @Override
    @EntityGraph(attributePaths = "categoria")
    Optional<Producto> findById(Long id);

    @EntityGraph(attributePaths = "categoria")
    List<Producto> findAll(Specification<Producto> filtro);

    /** RN-12: fila bloqueada hasta el fin de la transacción para mover existencias. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from Producto p join fetch p.categoria where p.id = :id")
    Optional<Producto> bloquear(Long id);

    boolean existsByCodigo(String codigo);

    boolean existsByCodigoAndIdNot(String codigo, Long id);
}

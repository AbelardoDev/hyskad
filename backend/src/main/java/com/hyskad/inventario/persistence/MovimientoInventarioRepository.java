package com.hyskad.inventario.persistence;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import com.hyskad.inventario.domain.MovimientoInventario;

public interface MovimientoInventarioRepository
        extends JpaRepository<MovimientoInventario, Long>, JpaSpecificationExecutor<MovimientoInventario> {

    /** Las respuestas muestran código y nombre del producto: se trae en la misma consulta. */
    @Override
    @EntityGraph(attributePaths = "producto")
    Page<MovimientoInventario> findAll(Specification<MovimientoInventario> filtro, Pageable pagina);

    @Override
    @EntityGraph(attributePaths = "producto")
    List<MovimientoInventario> findAll(Specification<MovimientoInventario> filtro, Sort orden);
}

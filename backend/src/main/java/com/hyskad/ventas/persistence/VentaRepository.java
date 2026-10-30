package com.hyskad.ventas.persistence;

import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import com.hyskad.ventas.domain.Venta;

import jakarta.persistence.LockModeType;

public interface VentaRepository
        extends JpaRepository<Venta, Long>, JpaSpecificationExecutor<Venta>, VentaResumenRepository {

    @Override
    @EntityGraph(attributePaths = "cliente")
    Page<Venta> findAll(Specification<Venta> filtro, Pageable pagina);

    /** Detalle completo: cliente, ítems y sus productos en una consulta. */
    @Override
    @EntityGraph(attributePaths = { "cliente", "detalles", "detalles.producto" })
    Optional<Venta> findById(Long id);

    /** Para anular: la fila queda bloqueada y dos anulaciones simultáneas no pasan ambas. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select v from Venta v left join fetch v.cliente where v.id = :id")
    Optional<Venta> bloquear(Long id);
}

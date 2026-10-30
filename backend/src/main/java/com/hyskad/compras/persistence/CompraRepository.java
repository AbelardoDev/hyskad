package com.hyskad.compras.persistence;

import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import com.hyskad.compras.domain.Compra;
import com.hyskad.compras.domain.EstadoCompra;

import jakarta.persistence.LockModeType;

public interface CompraRepository extends JpaRepository<Compra, Long>, JpaSpecificationExecutor<Compra> {

    @Override
    @EntityGraph(attributePaths = "proveedor")
    Page<Compra> findAll(Specification<Compra> filtro, Pageable pagina);

    /** Detalle completo: proveedor, ítems y sus productos en una consulta. */
    @Override
    @EntityGraph(attributePaths = { "proveedor", "detalles", "detalles.producto" })
    Optional<Compra> findById(Long id);

    /** Para anular: la fila queda bloqueada y dos anulaciones simultáneas no pasan ambas. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from Compra c join fetch c.proveedor where c.id = :id")
    Optional<Compra> bloquear(Long id);

    boolean existsByProveedorIdAndNumeroFacturaProveedorAndEstado(Long proveedorId, String numeroFactura,
            EstadoCompra estado);
}

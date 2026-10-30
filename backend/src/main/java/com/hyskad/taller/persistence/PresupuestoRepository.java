package com.hyskad.taller.persistence;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import com.hyskad.taller.domain.EstadoPresupuesto;
import com.hyskad.taller.domain.Presupuesto;

public interface PresupuestoRepository extends JpaRepository<Presupuesto, Long> {

    /** Todas las versiones de la orden con sus ítems, la más reciente primero. */
    @EntityGraph(attributePaths = "items")
    List<Presupuesto> findByOrdenIdOrderByVersionDesc(Long ordenId);

    Optional<Presupuesto> findFirstByOrdenIdAndEstado(Long ordenId, EstadoPresupuesto estado);

    @Override
    @EntityGraph(attributePaths = "items")
    Optional<Presupuesto> findById(Long id);

    /** Id de la orden de un presupuesto, para cargarla (y verificar quién la ve) antes que el presupuesto. */
    @Query("select p.orden.id from Presupuesto p where p.id = :id")
    Optional<Long> ordenDe(Long id);

    @Query("select coalesce(max(p.version), 0) from Presupuesto p where p.orden.id = :ordenId")
    int ultimaVersion(Long ordenId);
}

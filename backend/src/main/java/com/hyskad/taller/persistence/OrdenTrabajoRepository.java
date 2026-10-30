package com.hyskad.taller.persistence;

import java.util.Collection;
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

import com.hyskad.taller.domain.EstadoOrden;
import com.hyskad.taller.domain.OrdenTrabajo;

import jakarta.persistence.LockModeType;

public interface OrdenTrabajoRepository
        extends JpaRepository<OrdenTrabajo, Long>, JpaSpecificationExecutor<OrdenTrabajo> {

    // Las respuestas llevan cliente y moto: se traen en la misma consulta (open-in-view está
    // apagado). Los mecánicos se cargan por lotes (@BatchSize) y el historial solo en el detalle.

    @Override
    @EntityGraph(attributePaths = { "cliente", "motocicleta" })
    Page<OrdenTrabajo> findAll(Specification<OrdenTrabajo> filtro, Pageable pagina);

    @Override
    @EntityGraph(attributePaths = { "cliente", "motocicleta" })
    Optional<OrdenTrabajo> findById(Long id);

    /**
     * Para modificar: la versión sube al confirmar aunque solo cambien los mecánicos, así dos
     * ediciones hechas sobre la misma versión no pasan ambas. Sin {@code join fetch}: el bloqueo se
     * extendería a cliente y moto, que no tienen versión.
     */
    @Lock(LockModeType.OPTIMISTIC_FORCE_INCREMENT)
    @Query("select o from OrdenTrabajo o where o.id = :id")
    Optional<OrdenTrabajo> paraModificar(Long id);

    boolean existsByMotocicletaIdAndEstadoIn(Long motocicletaId, Collection<EstadoOrden> estados);

    boolean existsByClienteIdAndEstadoIn(Long clienteId, Collection<EstadoOrden> estados);

    Optional<OrdenTrabajo> findFirstByMotocicletaIdAndEstadoIn(Long motocicletaId, Collection<EstadoOrden> estados);

    @Query("select max(o.kilometrajeIngreso) from OrdenTrabajo o where o.motocicleta.id = :motocicletaId")
    Optional<Integer> maximoKilometrajeIngreso(Long motocicletaId);

    @Query("select max(o.kilometrajeInspeccion) from OrdenTrabajo o where o.motocicleta.id = :motocicletaId")
    Optional<Integer> maximoKilometrajeInspeccion(Long motocicletaId);

    @Query("select o.estado as estado, count(o) as cantidad from OrdenTrabajo o group by o.estado")
    List<ConteoEstado> contarPorEstado();

    @Query("""
            select o.estado as estado, count(o) as cantidad from OrdenTrabajo o
            where exists (select 1 from OrdenMecanico m where m.orden = o and m.id.mecanicoId = :mecanicoId)
            group by o.estado""")
    List<ConteoEstado> contarPorEstadoDelMecanico(Long mecanicoId);

    interface ConteoEstado {

        EstadoOrden getEstado();

        long getCantidad();
    }
}

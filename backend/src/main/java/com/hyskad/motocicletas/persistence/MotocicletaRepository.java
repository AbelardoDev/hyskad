package com.hyskad.motocicletas.persistence;

import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import com.hyskad.motocicletas.domain.Motocicleta;

public interface MotocicletaRepository
        extends JpaRepository<Motocicleta, Long>, JpaSpecificationExecutor<Motocicleta> {

    // Las respuestas siempre llevan el propietario: se trae en la misma consulta (sin N+1 ni
    // LazyInitializationException, porque open-in-view está apagado).

    @Override
    @EntityGraph(attributePaths = "cliente")
    Page<Motocicleta> findAll(Specification<Motocicleta> filtro, Pageable pagina);

    @Override
    @EntityGraph(attributePaths = "cliente")
    Optional<Motocicleta> findById(Long id);

    @EntityGraph(attributePaths = "cliente")
    List<Motocicleta> findByClienteId(Long clienteId, Sort orden);

    boolean existsByPlaca(String placa);

    boolean existsByPlacaAndIdNot(String placa, Long id);

    boolean existsByVin(String vin);

    boolean existsByVinAndIdNot(String vin, Long id);
}

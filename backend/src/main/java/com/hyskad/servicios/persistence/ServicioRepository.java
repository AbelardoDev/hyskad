package com.hyskad.servicios.persistence;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import com.hyskad.servicios.domain.Servicio;

public interface ServicioRepository extends JpaRepository<Servicio, Long>, JpaSpecificationExecutor<Servicio> {

    boolean existsByNombre(String nombre);

    boolean existsByNombreAndIdNot(String nombre, Long id);
}

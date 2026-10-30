package com.hyskad.configuracion.persistence;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.hyskad.configuracion.domain.Configuracion;

public interface ConfiguracionRepository extends JpaRepository<Configuracion, Long> {

    Optional<Configuracion> findByClave(String clave);
}

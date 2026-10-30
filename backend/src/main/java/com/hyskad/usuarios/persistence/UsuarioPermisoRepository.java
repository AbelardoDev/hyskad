package com.hyskad.usuarios.persistence;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.hyskad.usuarios.domain.UsuarioPermiso;

public interface UsuarioPermisoRepository extends JpaRepository<UsuarioPermiso, UsuarioPermiso.Clave> {

    List<UsuarioPermiso> findByUsuarioId(Long usuarioId);

    /** Borrado inmediato (no diferido al flush) para poder reinsertar los mismos permisos después. */
    @Modifying
    @Query("delete from UsuarioPermiso p where p.usuarioId = :usuarioId")
    void eliminarDeUsuario(@Param("usuarioId") Long usuarioId);
}

package com.hyskad.usuarios.persistence;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

import com.hyskad.usuarios.domain.Rol;
import com.hyskad.usuarios.domain.Usuario;

import jakarta.persistence.LockModeType;

public interface UsuarioRepository extends JpaRepository<Usuario, Long>, JpaSpecificationExecutor<Usuario> {

    Optional<Usuario> findByEmail(String email);

    boolean existsByEmail(String email);

    boolean existsByEmailAndIdNot(String email, Long id);

    boolean existsByRol(Rol rol);

    /** Administradores activos bloqueados para verificar RN-47 sin carreras entre dos admins. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from Usuario u where u.rol = com.hyskad.usuarios.domain.Rol.ADMIN and u.activo = true")
    List<Usuario> bloquearAdminsActivos();
}

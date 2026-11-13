package com.hyskad.notificaciones.persistence;

import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import com.hyskad.notificaciones.domain.Notificacion;

public interface NotificacionRepository extends JpaRepository<Notificacion, Long> {

    Page<Notificacion> findByUsuarioId(Long usuarioId, Pageable pagina);

    Page<Notificacion> findByUsuarioIdAndLeidaFalse(Long usuarioId, Pageable pagina);

    long countByUsuarioIdAndLeidaFalse(Long usuarioId);

    /** Solo la del usuario: la de otro no existe para él (RN de privacidad, 404). */
    Optional<Notificacion> findByIdAndUsuarioId(Long id, Long usuarioId);

    @Modifying(clearAutomatically = true)
    @Query("update Notificacion n set n.leida = true where n.usuarioId = :usuarioId and n.leida = false")
    int marcarTodasLeidas(Long usuarioId);
}

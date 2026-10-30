package com.hyskad.usuarios.application;

import java.time.Clock;
import java.time.Instant;
import java.util.Arrays;
import java.util.Collections;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.hyskad.shared.error.BusinessException;
import com.hyskad.shared.error.ErrorCode;
import com.hyskad.usuarios.domain.Permiso;
import com.hyskad.usuarios.domain.PermisosPorRol;
import com.hyskad.usuarios.domain.Rol;
import com.hyskad.usuarios.domain.Usuario;
import com.hyskad.usuarios.domain.UsuarioPermiso;
import com.hyskad.usuarios.persistence.UsuarioPermisoRepository;

/**
 * Permisos efectivos (RF4) = permisos del rol + concedidos − retirados. Los permisos solo admin
 * nunca se suman a un usuario de otro rol, aunque haya un ajuste guardado.
 */
@Service
public class PermisoService {

    private final UsuarioPermisoRepository repository;
    private final Clock clock;

    public PermisoService(UsuarioPermisoRepository repository, Clock clock) {
        this.repository = repository;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public Set<Permiso> permisosEfectivos(Usuario usuario) {
        return calcular(usuario.getRol(), ajustes(usuario.getId()));
    }

    static Set<Permiso> calcular(Rol rol, Map<Permiso, Boolean> ajustes) {
        EnumSet<Permiso> efectivos = EnumSet.noneOf(Permiso.class);
        efectivos.addAll(PermisosPorRol.de(rol));
        ajustes.forEach((permiso, concedido) -> {
            if (!concedido) {
                efectivos.remove(permiso);
            } else if (esConcedible(permiso, rol)) {
                efectivos.add(permiso);
            }
        });
        return Collections.unmodifiableSet(efectivos);
    }

    /** Vista por permiso para administrar los ajustes de un usuario. */
    @Transactional(readOnly = true)
    public List<PermisoDeUsuario> detalle(Usuario usuario, boolean esElUsuarioActual) {
        Map<Permiso, Boolean> ajustes = ajustes(usuario.getId());
        Set<Permiso> delRol = PermisosPorRol.de(usuario.getRol());
        Set<Permiso> efectivos = calcular(usuario.getRol(), ajustes);
        return Arrays.stream(Permiso.values())
                .map(permiso -> new PermisoDeUsuario(permiso, delRol.contains(permiso),
                        TipoAjuste.de(ajustes.get(permiso)), efectivos.contains(permiso),
                        !esElUsuarioActual && esConcedible(permiso, usuario.getRol()), permiso.isSoloAdmin()))
                .toList();
    }

    /**
     * Reemplaza los ajustes del usuario. Solo se guardan los que cambian algo respecto al rol
     * (conceder uno que ya trae el rol, o retirar uno que no trae, no se guarda).
     */
    @Transactional
    public void reemplazarAjustes(Usuario usuario, List<AjustePermiso> nuevos) {
        Set<Permiso> delRol = PermisosPorRol.de(usuario.getRol());
        Map<Permiso, Boolean> efectivos = new EnumMap<>(Permiso.class);
        for (AjustePermiso ajuste : nuevos) {
            if (ajuste.concedido() && !esConcedible(ajuste.permiso(), usuario.getRol())) {
                throw new BusinessException(ErrorCode.PERMISO_SOLO_ADMIN,
                        "El permiso " + ajuste.permiso() + " solo puede tenerlo un administrador",
                        Map.of("permiso", ajuste.permiso().name()));
            }
            if (ajuste.concedido() != delRol.contains(ajuste.permiso())) {
                efectivos.put(ajuste.permiso(), ajuste.concedido());
            }
        }
        repository.eliminarDeUsuario(usuario.getId());
        Instant ahora = Instant.now(clock);
        repository.saveAll(efectivos.entrySet().stream()
                .map(e -> new UsuarioPermiso(usuario.getId(), e.getKey(), e.getValue(), ahora))
                .toList());
    }

    private Map<Permiso, Boolean> ajustes(Long usuarioId) {
        Map<Permiso, Boolean> ajustes = new EnumMap<>(Permiso.class);
        repository.findByUsuarioId(usuarioId).forEach(a -> ajustes.put(a.getPermiso(), a.isConcedido()));
        return ajustes;
    }

    private static boolean esConcedible(Permiso permiso, Rol rol) {
        return !permiso.isSoloAdmin() || rol == Rol.ADMIN;
    }
}

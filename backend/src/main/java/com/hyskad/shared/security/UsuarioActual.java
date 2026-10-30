package com.hyskad.shared.security;

import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import com.hyskad.shared.error.BusinessException;
import com.hyskad.shared.error.ErrorCode;

/**
 * Datos del usuario autenticado en la petición en curso (id = {@code sub} del JWT, permisos =
 * authorities) y la IP de origen. Fuera de una petición autenticada devuelve vacíos.
 */
@Component
public class UsuarioActual {

    public Optional<Long> id() {
        Authentication autenticacion = SecurityContextHolder.getContext().getAuthentication();
        if (autenticacion instanceof JwtAuthenticationToken jwt && jwt.isAuthenticated()) {
            return Optional.of(Long.valueOf(jwt.getName()));
        }
        return Optional.empty();
    }

    /** Id del usuario autenticado; si no hay sesión responde 401. */
    public Long idRequerido() {
        return id().orElseThrow(() -> new BusinessException(ErrorCode.NO_AUTENTICADO, "Se requiere autenticación"));
    }

    public Set<String> permisos() {
        Authentication autenticacion = SecurityContextHolder.getContext().getAuthentication();
        if (autenticacion == null || !autenticacion.isAuthenticated()) {
            return Set.of();
        }
        return autenticacion.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .collect(Collectors.toUnmodifiableSet());
    }

    public boolean tienePermiso(String permiso) {
        return permisos().contains(permiso);
    }

    /** IP del cliente. En prod Nginx la entrega por X-Forwarded-For ({@code forward-headers-strategy}). */
    public Optional<String> ip() {
        if (RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes atributos) {
            return Optional.ofNullable(atributos.getRequest().getRemoteAddr());
        }
        return Optional.empty();
    }
}

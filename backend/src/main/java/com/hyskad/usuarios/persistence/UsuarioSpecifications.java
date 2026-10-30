package com.hyskad.usuarios.persistence;

import org.springframework.data.jpa.domain.Specification;

import com.hyskad.shared.persistence.Patrones;
import com.hyskad.usuarios.domain.Rol;
import com.hyskad.usuarios.domain.Usuario;

/** Filtros opcionales del listado de usuarios; un filtro nulo o vacío no restringe. */
public final class UsuarioSpecifications {

    private UsuarioSpecifications() {
    }

    public static Specification<Usuario> filtrar(String texto, Rol rol, Boolean activo) {
        return Specification.allOf(contieneTexto(texto), conRol(rol), conEstado(activo));
    }

    /** Coincidencia parcial en nombre o email (la collation de la BD ya ignora mayúsculas y tildes). */
    static Specification<Usuario> contieneTexto(String texto) {
        if (texto == null || texto.isBlank()) {
            return Specification.unrestricted();
        }
        String patron = Patrones.contiene(texto.trim());
        return (raiz, consulta, cb) -> cb.or(
                cb.like(raiz.get("nombre"), patron, Patrones.ESCAPE),
                cb.like(raiz.get("email"), patron, Patrones.ESCAPE));
    }

    static Specification<Usuario> conRol(Rol rol) {
        return rol == null ? Specification.unrestricted() : (raiz, consulta, cb) -> cb.equal(raiz.get("rol"), rol);
    }

    static Specification<Usuario> conEstado(Boolean activo) {
        return activo == null ? Specification.unrestricted() : (raiz, consulta, cb) -> cb.equal(raiz.get("activo"), activo);
    }
}

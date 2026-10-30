package com.hyskad.servicios.persistence;

import org.springframework.data.jpa.domain.Specification;

import com.hyskad.servicios.domain.Servicio;
import com.hyskad.shared.persistence.Patrones;

/** Filtros opcionales del catálogo de servicios (RF29); un filtro nulo o vacío no restringe. */
public final class ServicioSpecifications {

    private ServicioSpecifications() {
    }

    public static Specification<Servicio> filtrar(String texto, Boolean activo) {
        return Specification.allOf(contieneTexto(texto), conEstado(activo));
    }

    static Specification<Servicio> contieneTexto(String texto) {
        if (texto == null || texto.isBlank()) {
            return Specification.unrestricted();
        }
        String patron = Patrones.contiene(texto.trim());
        return (raiz, consulta, cb) -> cb.or(
                cb.like(raiz.get("nombre"), patron, Patrones.ESCAPE),
                cb.like(raiz.get("descripcion"), patron, Patrones.ESCAPE));
    }

    static Specification<Servicio> conEstado(Boolean activo) {
        return activo == null ? Specification.unrestricted() : (raiz, consulta, cb) -> cb.equal(raiz.get("activo"), activo);
    }
}

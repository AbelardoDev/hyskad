package com.hyskad.proveedores.persistence;

import org.springframework.data.jpa.domain.Specification;

import com.hyskad.proveedores.domain.Proveedor;
import com.hyskad.shared.persistence.Patrones;
import com.hyskad.shared.validation.Normalizador;

/** Filtros opcionales del listado de proveedores (RF29); un filtro nulo o vacío no restringe. */
public final class ProveedorSpecifications {

    private ProveedorSpecifications() {
    }

    public static Specification<Proveedor> filtrar(String texto, Boolean activo) {
        return Specification.allOf(contieneTexto(texto), conEstado(activo));
    }

    /** Razón social, contacto, documento (también sin puntos ni guion), teléfono o email. */
    static Specification<Proveedor> contieneTexto(String texto) {
        if (texto == null || texto.isBlank()) {
            return Specification.unrestricted();
        }
        String patron = Patrones.contiene(texto.trim());
        String documento = Patrones.contiene(Normalizador.documento(texto));
        return (raiz, consulta, cb) -> cb.or(
                cb.like(raiz.get("razonSocial"), patron, Patrones.ESCAPE),
                cb.like(raiz.get("contacto"), patron, Patrones.ESCAPE),
                cb.like(raiz.get("numeroDocumento"), patron, Patrones.ESCAPE),
                cb.like(cb.function("replace", String.class, raiz.get("numeroDocumento"), cb.literal("-"),
                        cb.literal("")), documento, Patrones.ESCAPE),
                cb.like(raiz.get("telefono"), patron, Patrones.ESCAPE),
                cb.like(raiz.get("email"), patron, Patrones.ESCAPE));
    }

    static Specification<Proveedor> conEstado(Boolean activo) {
        return activo == null ? Specification.unrestricted() : (raiz, consulta, cb) -> cb.equal(raiz.get("activo"), activo);
    }
}

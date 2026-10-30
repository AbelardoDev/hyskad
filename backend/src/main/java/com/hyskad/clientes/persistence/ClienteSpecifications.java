package com.hyskad.clientes.persistence;

import org.springframework.data.jpa.domain.Specification;

import com.hyskad.clientes.domain.Cliente;
import com.hyskad.shared.persistence.Patrones;
import com.hyskad.shared.validation.Normalizador;

/** Filtros opcionales del listado de clientes (RF29); un filtro nulo o vacío no restringe. */
public final class ClienteSpecifications {

    private ClienteSpecifications() {
    }

    public static Specification<Cliente> filtrar(String texto, Boolean activo) {
        return Specification.allOf(contieneTexto(texto), conEstado(activo));
    }

    /**
     * Coincidencia parcial en nombres, apellidos, razón social, documento, teléfono o email (la
     * collation ya ignora mayúsculas y tildes). El documento y el teléfono también se comparan
     * normalizados, para que {@code 900.123.456} o {@code 300 123} encuentren lo guardado.
     */
    static Specification<Cliente> contieneTexto(String texto) {
        if (texto == null || texto.isBlank()) {
            return Specification.unrestricted();
        }
        String patron = Patrones.contiene(texto.trim());
        String documento = Patrones.contiene(Normalizador.documento(texto));
        String telefono = Patrones.contiene(Normalizador.telefono(texto));
        return (raiz, consulta, cb) -> cb.or(
                cb.like(raiz.get("nombreCompleto"), patron, Patrones.ESCAPE),
                cb.like(raiz.get("numeroDocumento"), patron, Patrones.ESCAPE),
                cb.like(cb.function("replace", String.class, raiz.get("numeroDocumento"), cb.literal("-"),
                        cb.literal("")), documento, Patrones.ESCAPE),
                cb.like(raiz.get("telefono"), telefono, Patrones.ESCAPE),
                cb.like(raiz.get("email"), patron, Patrones.ESCAPE));
    }

    static Specification<Cliente> conEstado(Boolean activo) {
        return activo == null ? Specification.unrestricted() : (raiz, consulta, cb) -> cb.equal(raiz.get("activo"), activo);
    }
}

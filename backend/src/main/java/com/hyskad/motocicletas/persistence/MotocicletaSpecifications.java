package com.hyskad.motocicletas.persistence;

import org.springframework.data.jpa.domain.Specification;

import com.hyskad.motocicletas.domain.Motocicleta;
import com.hyskad.shared.persistence.Patrones;
import com.hyskad.shared.validation.Normalizador;

/** Filtros opcionales del listado de motos (RF29); un filtro nulo o vacío no restringe. */
public final class MotocicletaSpecifications {

    private MotocicletaSpecifications() {
    }

    public static Specification<Motocicleta> filtrar(String placa, String marca, String modelo, Long clienteId,
            Boolean activo) {
        return Specification.allOf(conPlaca(placa), contiene("marca", marca), contiene("modelo", modelo),
                delCliente(clienteId), conEstado(activo));
    }

    /** Placa parcial, normalizada como se guarda: {@code "abc-1"} encuentra {@code ABC12D}. */
    static Specification<Motocicleta> conPlaca(String placa) {
        String normalizada = Normalizador.placa(placa);
        if (normalizada == null || normalizada.isEmpty()) {
            return Specification.unrestricted();
        }
        String patron = Patrones.contiene(normalizada);
        return (raiz, consulta, cb) -> cb.like(raiz.get("placa"), patron, Patrones.ESCAPE);
    }

    static Specification<Motocicleta> contiene(String campo, String texto) {
        if (texto == null || texto.isBlank()) {
            return Specification.unrestricted();
        }
        String patron = Patrones.contiene(texto.trim());
        return (raiz, consulta, cb) -> cb.like(raiz.get(campo), patron, Patrones.ESCAPE);
    }

    static Specification<Motocicleta> delCliente(Long clienteId) {
        return clienteId == null ? Specification.unrestricted()
                : (raiz, consulta, cb) -> cb.equal(raiz.get("cliente").get("id"), clienteId);
    }

    static Specification<Motocicleta> conEstado(Boolean activo) {
        return activo == null ? Specification.unrestricted() : (raiz, consulta, cb) -> cb.equal(raiz.get("activo"), activo);
    }
}

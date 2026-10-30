package com.hyskad.ventas.persistence;

import java.time.Instant;

import org.springframework.data.jpa.domain.Specification;

import com.hyskad.shared.persistence.Patrones;
import com.hyskad.ventas.domain.EstadoVenta;
import com.hyskad.ventas.domain.MetodoPago;
import com.hyskad.ventas.domain.Venta;

/** Filtros opcionales del listado de ventas (RF29); un filtro nulo o vacío no restringe. */
public final class VentaSpecifications {

    private VentaSpecifications() {
    }

    /** {@code desde} incluido y {@code hasta} excluido. El vendedor es quien la registró. */
    public static Specification<Venta> filtrar(Instant desde, Instant hasta, Long clienteId, Long vendedorId,
            MetodoPago metodo, EstadoVenta estado, String numero) {
        return Specification.allOf(
                desde == null ? Specification.unrestricted()
                        : (raiz, consulta, cb) -> cb.greaterThanOrEqualTo(raiz.get("fecha"), desde),
                hasta == null ? Specification.unrestricted()
                        : (raiz, consulta, cb) -> cb.lessThan(raiz.get("fecha"), hasta),
                clienteId == null ? Specification.unrestricted()
                        : (raiz, consulta, cb) -> cb.equal(raiz.get("cliente").get("id"), clienteId),
                vendedorId == null ? Specification.unrestricted()
                        : (raiz, consulta, cb) -> cb.equal(raiz.get("createdBy"), vendedorId),
                metodo == null ? Specification.unrestricted()
                        : (raiz, consulta, cb) -> cb.equal(raiz.get("metodoPago"), metodo),
                estado == null ? Specification.unrestricted()
                        : (raiz, consulta, cb) -> cb.equal(raiz.get("estado"), estado),
                numero == null || numero.isBlank() ? Specification.unrestricted()
                        : (raiz, consulta, cb) -> cb.like(raiz.get("numero"), Patrones.contiene(numero.trim()),
                                Patrones.ESCAPE));
    }
}

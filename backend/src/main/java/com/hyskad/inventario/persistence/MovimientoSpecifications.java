package com.hyskad.inventario.persistence;

import java.time.Instant;

import org.springframework.data.jpa.domain.Specification;

import com.hyskad.inventario.domain.MovimientoInventario;
import com.hyskad.inventario.domain.TipoMovimiento;

/** Filtros opcionales de los movimientos de inventario; un filtro nulo no restringe. */
public final class MovimientoSpecifications {

    private MovimientoSpecifications() {
    }

    /** {@code desde} incluido y {@code hasta} excluido. */
    public static Specification<MovimientoInventario> filtrar(Long productoId, TipoMovimiento tipo, Instant desde,
            Instant hasta, Long usuarioId) {
        return Specification.allOf(
                igual("producto", productoId),
                tipo == null ? Specification.unrestricted() : (raiz, consulta, cb) -> cb.equal(raiz.get("tipo"), tipo),
                desde == null ? Specification.unrestricted()
                        : (raiz, consulta, cb) -> cb.greaterThanOrEqualTo(raiz.get("fecha"), desde),
                hasta == null ? Specification.unrestricted()
                        : (raiz, consulta, cb) -> cb.lessThan(raiz.get("fecha"), hasta),
                usuarioId == null ? Specification.unrestricted()
                        : (raiz, consulta, cb) -> cb.equal(raiz.get("usuarioId"), usuarioId));
    }

    private static Specification<MovimientoInventario> igual(String relacion, Long id) {
        return id == null ? Specification.unrestricted()
                : (raiz, consulta, cb) -> cb.equal(raiz.get(relacion).get("id"), id);
    }
}

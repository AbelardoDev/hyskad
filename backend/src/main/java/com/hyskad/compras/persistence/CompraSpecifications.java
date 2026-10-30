package com.hyskad.compras.persistence;

import java.time.LocalDate;

import org.springframework.data.jpa.domain.Specification;

import com.hyskad.compras.domain.Compra;
import com.hyskad.compras.domain.EstadoCompra;
import com.hyskad.shared.persistence.Patrones;

/** Filtros opcionales del listado de compras (RF21, RF29); un filtro nulo o vacío no restringe. */
public final class CompraSpecifications {

    private CompraSpecifications() {
    }

    /** Fechas inclusivas. {@code numero} busca en el consecutivo y en la factura del proveedor. */
    public static Specification<Compra> filtrar(Long proveedorId, LocalDate desde, LocalDate hasta,
            EstadoCompra estado, String numero) {
        return Specification.allOf(
                proveedorId == null ? Specification.unrestricted()
                        : (raiz, consulta, cb) -> cb.equal(raiz.get("proveedor").get("id"), proveedorId),
                desde == null ? Specification.unrestricted()
                        : (raiz, consulta, cb) -> cb.greaterThanOrEqualTo(raiz.get("fecha"), desde),
                hasta == null ? Specification.unrestricted()
                        : (raiz, consulta, cb) -> cb.lessThanOrEqualTo(raiz.get("fecha"), hasta),
                estado == null ? Specification.unrestricted()
                        : (raiz, consulta, cb) -> cb.equal(raiz.get("estado"), estado),
                conNumero(numero));
    }

    static Specification<Compra> conNumero(String numero) {
        if (numero == null || numero.isBlank()) {
            return Specification.unrestricted();
        }
        String patron = Patrones.contiene(numero.trim());
        return (raiz, consulta, cb) -> cb.or(
                cb.like(raiz.get("numero"), patron, Patrones.ESCAPE),
                cb.like(raiz.get("numeroFacturaProveedor"), patron, Patrones.ESCAPE));
    }
}

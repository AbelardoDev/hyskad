package com.hyskad.catalogo.persistence;

import org.springframework.data.jpa.domain.Specification;

import com.hyskad.catalogo.domain.Producto;
import com.hyskad.shared.persistence.Patrones;

/** Filtros opcionales del listado de productos (RF29); un filtro nulo o vacío no restringe. */
public final class ProductoSpecifications {

    private ProductoSpecifications() {
    }

    public static Specification<Producto> filtrar(String texto, Long categoriaId, String marca, Boolean activo,
            boolean soloStockBajo) {
        return Specification.allOf(contieneTexto(texto), deCategoria(categoriaId), deMarca(marca), conEstado(activo),
                soloStockBajo ? conStockBajo() : Specification.unrestricted());
    }

    /** Coincidencia parcial en código, nombre o marca. */
    static Specification<Producto> contieneTexto(String texto) {
        if (texto == null || texto.isBlank()) {
            return Specification.unrestricted();
        }
        String patron = Patrones.contiene(texto.trim());
        return (raiz, consulta, cb) -> cb.or(
                cb.like(raiz.get("codigo"), patron, Patrones.ESCAPE),
                cb.like(raiz.get("nombre"), patron, Patrones.ESCAPE),
                cb.like(raiz.get("marca"), patron, Patrones.ESCAPE));
    }

    static Specification<Producto> deCategoria(Long categoriaId) {
        return categoriaId == null ? Specification.unrestricted()
                : (raiz, consulta, cb) -> cb.equal(raiz.get("categoria").get("id"), categoriaId);
    }

    static Specification<Producto> deMarca(String marca) {
        if (marca == null || marca.isBlank()) {
            return Specification.unrestricted();
        }
        String patron = Patrones.contiene(marca.trim());
        return (raiz, consulta, cb) -> cb.like(raiz.get("marca"), patron, Patrones.ESCAPE);
    }

    static Specification<Producto> conEstado(Boolean activo) {
        return activo == null ? Specification.unrestricted() : (raiz, consulta, cb) -> cb.equal(raiz.get("activo"), activo);
    }

    /** RN-14: productos activos con disponible (actual − reservado) en el mínimo o por debajo. */
    public static Specification<Producto> conStockBajo() {
        return (raiz, consulta, cb) -> cb.and(cb.isTrue(raiz.get("activo")),
                cb.le(cb.diff(raiz.get("stockActual"), raiz.get("stockReservado")), raiz.get("stockMinimo")));
    }
}
